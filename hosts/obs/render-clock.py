"""待機画面の時計(overlays の clock-face)の画像を Blender の Cycles で描画する。

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P hosts/obs/render-clock.py -- hosts/obs/overlays/clock-face

-- の後に時刻(10:08 の形)を付けると、その時刻の時計を 1 枚(preview-HHMM.png)だけ描画する(確認用)。

時計は文字盤を持たず、インデックス、分の目盛、針、キャップを画面の地の上に置く。
インデックスと針は暗い鋼で、溝に LED を埋め込む。光源は画面の光源の方向から当てる。

出力:
    dial.png           インデックスと分の目盛
    hour-NN.png        短針。NN は 0〜71 で、角度は 5° × NN(上を 0° とした時計回り)
    minute-NN.png      長針。NN は 0〜59 で、角度は 6° × NN
    cap.png            中心のキャップ

シーン、光源、部品の作り方は scene_parts.py と共通。
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix

# scene_parts.py を読み込む。リポジトリに __pycache__ を残さないよう、バイトコードは書き出さない。
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scene_parts import as_metal, link, material, render, reset, srgb, stage  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = Path(ARGS[0]).resolve()
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
# LED の明るさ。
LUME_STRENGTH = 1.0
# 待機画面で時計を置く位置(中心 px)と大きさ(px)。光源の方向をここから決める。
PLACE = ((578, 358), 380)
# 光源の強さ(scene_parts.stage の level)。
LIGHT_LEVEL = 0.5
HOUR_STEP = 5
MINUTE_STEP = 6

# 針と中心のキャップの、地からの高さ(計器の座標の 1/100)。
HOUR_Z = 0.035
MINUTE_Z = 0.05
CAP_Z = 0.07


def carve_led(obj, length, width, top, depth, start=0.0):
    """obj の天面に、+Y 方向に伸びる溝(長さ length、幅 width、深さ depth)を彫り、溝の底に平らな LED を置く。
    LED は天面より depth だけ沈み、上から見ると金属の枠の中に光る線が埋まって見える。"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    cutter = bpy.context.active_object
    cutter.scale = (width, length, depth * 4)
    cutter.location = (0, start + length / 2, top)
    cutter.parent = obj
    cut = obj.modifiers.new('slot', 'BOOLEAN')
    cut.operation = 'DIFFERENCE'
    cut.object = cutter
    cut.solver = 'EXACT'
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter)
    bpy.ops.mesh.primitive_plane_add(size=1)
    led = bpy.context.active_object
    led.name = f'{obj.name}-led'
    led.scale = (width, length, 1)
    led.location = (0, start + length / 2, top - depth + 0.0005)
    led.data.materials.append(lume(1.0))
    led.parent = obj
    return led


def flat_bar(name, length, width, height, mat):
    """天面が平らで、縁を細く面取りした棒。原点から +Y へ伸びる。"""
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width, length, height)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.transform(Matrix.Translation((0, length / 2, height / 2)))
    bev = obj.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.004
    bev.segments = 2
    obj.data.materials.append(mat)
    return obj


def dauphine(name, length, width, tail, height, mat):
    """ドーフィン針。中央の稜線で 2 面に分かれ、先端と根元へ向かって細くなる。原点から +Y へ伸びる。"""
    bm = bmesh.new()
    widest = length * 0.18
    outline = [(0, -tail), (width * 0.35, 0), (width / 2, widest), (0, length), (-width / 2, widest), (-width * 0.35, 0)]
    base = [bm.verts.new((x, y, 0)) for x, y in outline]
    # 稜線は中心線(x=0)の上に通す。
    ridge = [bm.verts.new((0, y, height)) for y in (-tail, 0, widest, length)]
    bm.faces.new(list(reversed(base)))
    # 右の 3 面と左の 3 面。どの面も、外形の辺と稜線を結ぶ。
    tops = [
        (base[0], base[1], ridge[1], ridge[0]),
        (base[1], base[2], ridge[2], ridge[1]),
        (base[2], base[3], ridge[3], ridge[2]),
        (base[3], base[4], ridge[2], ridge[3]),
        (base[4], base[5], ridge[1], ridge[2]),
        (base[5], base[0], ridge[0], ridge[1]),
    ]
    for f in tops:
        bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def build_dial():
    """インデックスと分の目盛。影は、影だけを受ける面(scene_parts.stage の dial)に落ちる。"""
    # 枠の金属は暗くし、照明の映り込みと LED を見分けられるようにする。
    steel = material('index', srgb('#55575d'), metallic=1.0, roughness=0.06)
    for h in range(12):
        a = math.radians(h * 30)
        offsets = (-0.035, 0.035) if h == 0 else (0.0,)
        for k, off in enumerate(offsets):
            # 天面の平らな金属の棒に溝を彫り、溝の底に LED を埋める。
            bar = as_metal(flat_bar(f'index{h}-{k}', 0.34, 0.06, 0.028, steel))
            carve_led(bar, 0.28, 0.028, 0.028, 0.008, start=0.03)
            bar.rotation_euler = (0, 0, -a)
            bar.location = (1.30 * math.sin(a) + off * math.cos(a), 1.30 * math.cos(a) - off * math.sin(a), 0.006)
    # 分の目盛は、地に刷った弱く光る線。
    for i in range(60):
        if i % 5 == 0:
            continue
        a = math.radians(i * 6)
        bpy.ops.mesh.primitive_plane_add(size=1)
        mark = bpy.context.active_object
        mark.name = f'minute-mark{i}'
        mark.scale = (0.012, 0.06, 1)
        mark.rotation_euler = (0, 0, -a)
        mark.location = (1.70 * math.sin(a), 1.70 * math.cos(a), 0.001)
        mark.data.materials.append(lume(0.35))


def lume(level):
    """発光する白(LED の光)。暗い地の上でも時刻を読めるように、インデックスと針に入れる。
    照明を映すと金属と見分けがつかないので、反射の無い発光だけの面(完全なつや消し)にする。"""
    m = bpy.data.materials.get(f'lume-{level}')
    if m:
        return m
    m = bpy.data.materials.new(f'lume-{level}')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*srgb('#eceaf2'), 1)
    e.inputs['Strength'].default_value = LUME_STRENGTH * level
    nt.links.new(e.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m


def hand_material():
    return material('hand', srgb('#5f6167'), metallic=1.0, roughness=0.08)


def hand(name, length, width, tail, height):
    """磨いた金属のドーフィン針。稜線に沿って溝を彫り、溝の底に LED を埋める。"""
    obj = as_metal(dauphine(name, length, width, tail, height, hand_material()))
    carve_led(obj, length * 0.62, width * 0.3, height, height * 0.6, start=length * 0.2)
    return obj


def build_hour():
    return hand('hour', 0.95, 0.09, 0.14, 0.02)


def build_minute():
    return hand('minute', 1.48, 0.07, 0.18, 0.018)


def build_cap():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.075)
    cap = bpy.context.active_object
    cap.name = 'cap'
    cap.scale = (1, 1, 0.45)
    for p in cap.data.polygons:
        p.use_smooth = True
    cap.data.materials.append(material('cap', srgb('#e6e4ee'), metallic=1.0, roughness=0.08))
    cap.location.z = CAP_Z
    return as_metal(cap)


def scene_with(build):
    scene = reset()
    stage(scene, PLACE, LIGHT_LEVEL)
    return scene, build()


def preview(hhmm):
    """文字盤と針を 1 つのシーンで描く(確認用)。"""
    h, m = (int(x) for x in hhmm.split(':'))
    scene = reset()
    stage(scene, PLACE, LIGHT_LEVEL)
    build_dial()
    hour = build_hour()
    hour.location.z = HOUR_Z
    hour.rotation_euler = (0, 0, -math.radians((h % 12) * 30 + m * 0.5))
    minute = build_minute()
    minute.location.z = MINUTE_Z
    minute.rotation_euler = (0, 0, -math.radians(m * 6))
    build_cap()
    render(scene, OUT / f'preview-{h:02d}{m:02d}.png')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if PREVIEW:
        preview(PREVIEW)
        return
    # 部品ごとに別の画像にする。針は角度ごとに光の当たり方が変わるので、角度ごとに描く。
    scene, _ = scene_with(build_dial)
    render(scene, OUT / 'dial.png')
    scene, _ = scene_with(build_cap)
    render(scene, OUT / 'cap.png')
    for name, build, z, step in (('hour', build_hour, HOUR_Z, HOUR_STEP), ('minute', build_minute, MINUTE_Z, MINUTE_STEP)):
        scene, obj = scene_with(build)
        obj.location.z = z
        for n in range(360 // step):
            obj.rotation_euler = (0, 0, -math.radians(n * step))
            render(scene, OUT / f'{name}-{n:02d}.png')


main()
