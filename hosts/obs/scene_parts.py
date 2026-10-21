"""計器と時計の画像を Blender の Cycles で描画する時の、共通のシーンと部品。

シーンの単位は画面の座標(400x400)の 1/100。中心が原点、画面の上が +Y、手前が +Z。
光源は画面の上の中央の手前に置いた 1 つのソフトボックスで、全部品に共通にする。
"""

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector

SIZE = 800  # 400 単位を 2 倍の解像度で描く
# 光源の強さ。KEY は正面を向く平らな塗装の面が指定の色になる強さ。
# FILL は反射板の輝度が約 1 になる強さ(10x10 の面なので 100π)で、金属の平らな天面に素材の色がそのまま出る。
KEY = float(os.environ.get('KEY', 440))
FILL = float(os.environ.get('FILL', 314))
# 環境の明るさ。
ENV = float(os.environ.get('ENV', 0.3))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    # GPU(Metal)だけで描画する。CPU を併用すると、CPU の負荷が上がるうえに速くならない。
    for d in prefs.devices:
        d.use = d.type == 'METAL'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = int(os.environ.get('SAMPLES', 256))
    scene.cycles.use_denoising = True
    # 樹脂の中で光が散乱し、内面で全反射しながら先端まで届くように、反射と散乱の回数を増やす。
    scene.cycles.max_bounces = 48
    scene.cycles.transmission_bounces = 48
    scene.cycles.volume_bounces = 32
    scene.cycles.glossy_bounces = 16
    scene.cycles.transparent_max_bounces = 16
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    # 塗装の色を指定どおりに出すため、トーンマッピングをしない。
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    return scene


def material(name, color, metallic=0.0, roughness=0.4, emission=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Coat Weight'].default_value = coat
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    return m


def srgb(hex_):
    """#rrggbb を Blender の線形の値にする。"""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(hex_[i:i + 2], 16)) for i in (1, 3, 5))


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def metal_collection():
    """反射板を映す金属の部品を入れるコレクション。"""
    coll = bpy.data.collections.get('METAL') or bpy.data.collections.new('METAL')
    return coll


def as_metal(obj):
    metal_collection().objects.link(obj)
    return obj


def lathe(name, profile, mat, steps=512):
    """(半径, 高さ) の断面を Z 軸の周りに 1 周回した輪を作る。断面の角は面取りの面として残す。"""
    bm = bmesh.new()
    rings = []
    for k in range(steps):
        a = 2 * math.pi * k / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for k in range(steps):
        a, b = rings[k], rings[(k + 1) % steps]
        for i in range(len(profile) - 1):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    smooth_by_angle(obj, 20)
    return obj


def smooth_by_angle(obj, degrees):
    """断面の角は鋭く、周方向は滑らかにする。"""
    for p in obj.data.polygons:
        p.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(degrees))
    obj.select_set(False)


def pill(name, length, width, height, mat):
    """角を丸めた粒。原点を中心に Y 方向へ伸びる。"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, length, height)
    bpy.ops.object.transform_apply(scale=True)
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = width * 0.45
    bev.segments = 6
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def block(name, center, size, bevel, mat, segments=3):
    """縁を面取りした直方体の部品(板金など)。segments=1 で平らな 45° の面取り、多いほど丸い。"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    obj.location = center
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = bevel
    bev.segments = segments
    bev.harden_normals = True
    obj.data.materials.append(mat)
    return obj


def arc_band(name, r0, r1, height, a0, a1, mat, steps=24, bevel=0.003, segments=3):
    """Z 軸の周りの角度 a0〜a1(+Y から時計回りの度)の範囲の、断面が四角い円弧の帯。"""
    bm = bmesh.new()
    rings = []
    for k in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * k / steps)
        sx, cy = math.sin(a), math.cos(a)
        rings.append([bm.verts.new((r * sx, r * cy, z)) for r, z in ((r0, 0), (r0, height), (r1, height), (r1, 0))])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = bevel
    bev.segments = segments
    bev.harden_normals = True
    obj.data.materials.append(mat)
    return obj


def tube(name, points, radius, mat):
    """折れ線に沿った丸い断面の金属線。"""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    spline = curve.splines.new('POLY')
    spline.points.add(len(points) - 1)
    for p, (x, y, z) in zip(spline.points, points):
        p.co = (x, y, z, 1)
    obj = link(bpy.data.objects.new(name, curve))
    obj.data.materials.append(mat)
    return obj


def stage(scene):
    # 正射影のカメラで真上から写す。
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 4.0
    cam_obj = link(bpy.data.objects.new('cam', cam))
    cam_obj.location = (0, 0, 10)
    scene.camera = cam_obj

    # 画面の上の中央の手前にあるソフトボックス(主の光源)。金属にはこの映り込みが帯として出る。
    key = bpy.data.lights.new('key', 'AREA')
    key.shape = 'RECTANGLE'
    key.size = 6.0
    key.size_y = 1.6
    key.energy = KEY
    key_obj = link(bpy.data.objects.new('key', key))
    key_obj.location = (0, 3.2, 4.2)
    key_obj.rotation_euler = (Vector((0, 0, 0)) - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

    # 視点の側の大きな反射板。金属の部品(METAL のコレクション)の映り込みにだけ効く。
    # 正面を向く金属の天面は、真上のこの板を映して明るくなる。塗装と目盛には効かない。
    fill = bpy.data.lights.new('fill', 'AREA')
    fill.shape = 'SQUARE'
    fill.size = 10.0
    fill.energy = FILL
    fill_obj = link(bpy.data.objects.new('fill', fill))
    fill_obj.location = (0, 0, 9)
    fill_obj.visible_diffuse = False
    fill_obj.light_linking.receiver_collection = metal_collection()

    # 周りの環境はほぼ黒。金属の下向きの面が真っ黒にならない程度の明るさにする。
    world = bpy.data.worlds.new('world')
    world.use_nodes = True
    nt = world.node_tree
    # 周りの環境。下と横は暗く、上(+Y)の手前(+Z)ほど明るい。斜め上には細長い窓の帯がある。
    # 艶のある面(金属と樹脂)は、面の向きに応じてこの環境の違う部分を映す。
    coord = nt.nodes.new('ShaderNodeTexCoord')
    xyz = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(coord.outputs['Generated'], xyz.inputs[0])
    def ramp(src, a, b):
        m = nt.nodes.new('ShaderNodeMapRange')
        m.interpolation_type = 'SMOOTHSTEP'
        m.inputs['From Min'].default_value = a
        m.inputs['From Max'].default_value = b
        nt.links.new(src, m.inputs['Value'])
        return m.outputs['Result']
    def mul(a, b):
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(a, m.inputs[0])
        if isinstance(b, float):
            m.inputs[1].default_value = b
        else:
            nt.links.new(b, m.inputs[1])
        return m.outputs[0]
    def add(a, b):
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'ADD'
        nt.links.new(a, m.inputs[0])
        nt.links.new(b, m.inputs[1])
        return m.outputs[0]
    sky = mul(mul(ramp(xyz.outputs['Y'], -0.2, 0.8), ramp(xyz.outputs['Z'], 0.0, 0.7)), ENV)
    band = mul(mul(ramp(xyz.outputs['Y'], 0.45, 0.5), ramp(xyz.outputs['Y'], 0.62, 0.57)), ramp(xyz.outputs['Z'], 0.2, 0.4))
    window = mul(band, ENV * 4)
    bg = nt.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    base = nt.nodes.new('ShaderNodeValue')
    base.outputs[0].default_value = 0.012
    nt.links.new(add(add(sky, window), base.outputs[0]), bg.inputs['Strength'])
    scene.world = world

    # 計器の面。影だけを受ける(透過の画像に影を残す)。
    bpy.ops.mesh.primitive_plane_add(size=6)
    dial = bpy.context.active_object
    dial.name = 'dial'
    dial.is_shadow_catcher = True


def resin(name, transmit, dye, density):
    """着色した透明な樹脂(アクリル)。表面で屈折・全反射し、中では染料が光を吸収し、わずかに散乱する。
    transmit は染料が通す色。色と明るさは、光が樹脂の中をどう通ってきたかで決まる。"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (1, 1, 1, 1)
    p.inputs['Roughness'].default_value = 0.0
    p.inputs['IOR'].default_value = 1.49
    p.inputs['Transmission Weight'].default_value = 1.0
    scatter = nt.nodes.new('ShaderNodeVolumeScatter')
    scatter.inputs['Color'].default_value = (1, 1, 1, 1)
    scatter.inputs['Density'].default_value = density
    absorb = nt.nodes.new('ShaderNodeVolumeAbsorption')
    absorb.inputs['Color'].default_value = (*transmit, 1)
    absorb.inputs['Density'].default_value = dye
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(scatter.outputs[0], add.inputs[0])
    nt.links.new(absorb.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    return m


def led(name, size, strength):
    """付け根の白色の LED の発光面。+Y(先端)を向く。"""
    bpy.ops.mesh.primitive_plane_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], 1)
    obj.rotation_euler = (math.radians(-90), 0, 0)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    obj.data.materials.append(m)
    return obj


def loft(name, stations, mats_by_y):
    """針の長さの方向の各位置 (v, 半幅, 高さ, 面取り) の断面をつないだ立体。
    断面は、底面、垂直な側面、45° の面取り、平らな天面の六角形。"""
    bm = bmesh.new()
    rings = []
    for v, hw, h, c in stations:
        rings.append([bm.verts.new(co) for co in (
            (-hw, v, 0), (-hw, v, h - c), (-hw + c, v, h), (hw - c, v, h), (hw, v, h - c), (hw, v, 0),
        )])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    for _, m in mats_by_y:
        obj.data.materials.append(m)
    for poly in obj.data.polygons:
        y = poly.center.y
        poly.material_index = next(i for i, (limit, _) in enumerate(mats_by_y) if y < limit)
    # 成形品の稜は完全な角にならない。細い丸みを付け、稜に細いハイライトを出す。
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.003
    bev.segments = 3
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(20)
    bev.harden_normals = True
    return obj


def render(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    # 影を受ける面には、ノイズ除去で影の無い所にも 1% 未満の不透明度が残る。これを 0 にし、ファイルを小さくする。
    img = bpy.data.images.load(str(path))
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    px[px[:, 3] < 0.01] = 0
    img.pixels[:] = px.ravel()
    img.save()
    bpy.data.images.remove(img)
