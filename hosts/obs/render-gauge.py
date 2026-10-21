"""計器(overlays の gauge)の画像を Blender の Cycles で描画する。

    /Applications/Blender.app/Contents/MacOS/Blender -b -P hosts/obs/render-gauge.py -- hosts/obs/overlays/gauge

-- の後に番号(0〜60)を続けると、その番号の針だけを描画する(確認用)。

出力:
    static.png         目盛、内側の輪(針を除く固定の部品)
    needle-NN.png      針。NN は 0〜60 で、角度は -150° + 5° × NN(上を 0° とした時計回り)

シーン、光源、部品の作り方は scene_parts.py と共通。光源は画面の光源の方向から当てる。
"""

import math
import os
import sys
from pathlib import Path

import bpy

# scene_parts.py を読み込む。リポジトリに __pycache__ を残さないよう、バイトコードは書き出さない。
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scene_parts import as_metal, arc_band, block, lathe, led, link, loft, material, pill, render, reset, resin, srgb, stage  # noqa: E402

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = Path(ARGS[0]).resolve()
ONLY = [int(a) for a in ARGS[1:]]
STEP = 5
# 針の文字盤からの高さ。
FLOAT = 0.03
# 樹脂: 染料が通す色(線形の値)と吸収の密度、散乱の密度、付け根の LED の強さ。
TRANSMIT = tuple(float(c) for c in os.environ.get('TRANSMIT', '0.97,0.12,0.04').split(','))
DYE = float(os.environ.get('DYE', 60))
DENSITY = float(os.environ.get('DENSITY', 1))
GLOW = float(os.environ.get('GLOW', 600))
ANGLES = list(range(-150, 151, STEP))
# UP NEXT で計器を置く位置(中心 px)と大きさ(px)と、光源の強さ。時計(render-clock.py)と同じ光で描く。
PLACE = ((296, 400), 400)
LIGHT_LEVEL = 0.5


def build_static():
    wire = material('wire', srgb('#b9b6c4'), metallic=1.0, roughness=0.3)
    lamp = material('tick', srgb('#2a2a2e'), roughness=0.35, emission=srgb('#eceaf2'), strength=1.0, coat=0.6)
    # 内側の細い金属線。
    as_metal(lathe('inner', [(0.991, 0.0), (0.996, 0.007), (1.004, 0.007), (1.009, 0.0)], wire))
    # 目盛の粒。大きい目盛は 6 本、その間に 4 本ずつ。
    for i in range(31):
        deg = -150 + 10 * i
        major = i % 5 == 0
        length, width, r = (0.12, 0.06, 1.57) if major else (0.06, 0.04, 1.57)
        t = pill(f'tick{i}', length, width, 0.016, lamp)
        a = math.radians(deg)
        t.location = (r * math.sin(a), r * math.cos(a), 0.008)
        t.rotation_euler = (0, 0, -a)


def build_needle():
    acrylic = resin('acrylic', TRANSMIT, DYE, DENSITY)
    # 先端は白く塗装する。
    tip = material('tip', srgb('#f1eff5'), roughness=0.35, coat=0.3)
    clip = material('socket', srgb('#cfccd9'), metallic=1.0, roughness=0.22)
    # 針は +Y(画面の上)向きで作る。内側の輪の縁(1.00)から目盛の外(1.67)まで。
    # 付け根は強度のために厚く、約 40° の斜面で薄い胴へ下がる。胴は平らな天面で先へ向かって細く薄くなる。
    # 天面の両側の稜は 45° で面取りする。先端は平面の角を 45° で落とし、低くして斜めに切る。
    # 厚い付け根と斜面は、光が樹脂の中を長く通るため赤く、薄い胴は橙に見える。
    stations = [
        (1.00, 0.050, 0.050, 0.012),
        (1.10, 0.050, 0.050, 0.012),
        (1.14, 0.046, 0.028, 0.008),
        (1.55, 0.036, 0.024, 0.007),
        (1.62, 0.036, 0.024, 0.007),
        (1.67, 0.016, 0.010, 0.003),
    ]
    needle = loft('needle', stations, [(1.62, acrylic), (9, tip)])
    # LED は付け根の端面のすぐ内側に置く。
    light = led('led', (0.09, 0.045), GLOW)
    light.location = (0, 1.004, FLOAT + 0.025)
    parts = [needle, light]
    # 受け口。針の付け根を両脇から挟む板金の部品で、内側の輪に沿って曲がったフランジで輪の上に載る。
    # 上から見ると、輪から左右に曲がって立ち上がり、針の両脇に沿う L 字になる(MIB2 の受け口の形)。
    for sx in (-1, 1):
        x = sx * (stations[0][1] + 0.016)
        parts.append(as_metal(block(f'socket-wall{sx}', (x, 1.06, 0.033), (0.026, 0.12, 0.066), 0.008, clip, segments=1)))
        a0, a1 = sorted((sx * 2.5, sx * 11.0))
        parts.append(as_metal(arc_band(f'socket-flange{sx}', 0.99, 1.03, 0.02, a0, a1, clip, bevel=0.008, segments=1)))
    pivot = link(bpy.data.objects.new('pivot', None))
    for p in parts:
        p.parent = pivot
    # 針は文字盤から浮いていて、光源と反対側(画面の下)へずれた影を落とす。
    needle.location.z = FLOAT
    return pivot


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    # 番号を指定した確認用の描画では、固定の部品の画像があれば描き直さない。
    if not (ONLY and (OUT / 'static.png').exists()):
        scene = reset()
        stage(scene, PLACE, LIGHT_LEVEL)
        build_static()
        render(scene, OUT / 'static.png')

    scene = reset()
    stage(scene, PLACE, LIGHT_LEVEL)
    pivot = build_needle()
    for n, deg in enumerate(ANGLES):
        if ONLY and n not in ONLY:
            continue
        pivot.rotation_euler = (0, 0, -math.radians(deg))
        render(scene, OUT / f'needle-{n:02d}.png')


main()
