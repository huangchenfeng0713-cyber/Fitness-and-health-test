"""Backgrounds: one flat palette + props per life stage, cross-faded on the downbeats.

Layers:  background()  screen-space sky / wall + parallax props (drawn first)
         world_back()  world-space props behind the crowd
         world_mid()   between crowd and hero
         world_front() in front of the hero (desk, mat edge ...)
"""
import math
import random

import cairo

from .anim import smooth, smoother, clamp
from .draw import hexc, mixc, INK, disc, poly, stroke_line, text_world
from .timeline import TL, W, H

# ------------------------------------------------------------------ stage schedule
SEG_STAGE = {'S1': 'baby', 'S2': 'kid', 'S3': 'school', 'S4': 'army', 'S5': 'teen',
             'S6': 'office', 'S7': 'plaza', 'S8': 'park'}
FLASH = ['baby', 'kid', 'school', 'army', 'teen', 'office', 'plaza', 'park']


def _schedule():
    sw = [(-10.0, 'baby', 0.01)]
    for key in ('S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'):
        s = TL.S[key]
        fade = 0.45 * s.spb
        t0 = s.t0 - 0.12 * s.spb
        if key == 'S6':                       # the office slides in under the slowing hands
            t0, fade = TL.S['S5'].t(14.6), TL.S['S5'].spb * 1.2
        sw.append((t0, SEG_STAGE[key], fade))
    S9 = TL.S['S9']
    for b, st in enumerate(FLASH):
        sw.append((S9.t(b) - 0.02, st, 0.04))
    sw.append((TL.t_morph, 'baby', 0.3))
    sw.sort(key=lambda s: s[0])
    return sw


SCHEDULE = _schedule()


def stage_mix(t):
    """[(stage, weight)] of the stages visible at t."""
    cur = SCHEDULE[0][1]
    for i in range(1, len(SCHEDULE)):
        ts, st, fade = SCHEDULE[i]
        if t < ts:
            break
        u = smooth((t - ts) / fade)
        if u < 1:
            return [(cur, 1 - u), (st, u)]
        cur = st
    return [(cur, 1.0)]


def stage_weight(t, stage):
    return sum(w for s, w in stage_mix(t) if s == stage)


def crowd_fade(ctx, vis):
    if vis < 0.999:
        ctx.push_group()


def crowd_fade_end(ctx, vis):
    if vis < 0.999:
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(vis)


# ------------------------------------------------------------------ helpers
def lin_grad(ctx, y0, y1, c0, c1, x0=0, x1=W):
    g = cairo.LinearGradient(0, y0, 0, y1)
    g.add_color_stop_rgb(0, *c0)
    g.add_color_stop_rgb(1, *c1)
    ctx.set_source(g)
    ctx.rectangle(x0, min(y0, y1) - 2000, x1 - x0, abs(y1 - y0) + 4000)
    ctx.fill()


def layer(ctx, cam, par, scale):
    """Pseudo-world transform for a parallax layer (par=1 is the real world)."""
    z = 1 + (cam['zoom'] - 1) * par
    ctx.scale(scale, scale)
    ctx.translate(W / 2 + cam['sx'] * par, cam['ground'] + cam['sy'] * par)
    ctx.scale(z, -z)
    ctx.translate(-cam['cx'] * par, 0)


def rrect(ctx, x, y, w, h, r):
    ctx.new_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 1.5 * math.pi)
    ctx.close_path()


def fill(ctx, col, a=1.0):
    ctx.set_source_rgba(*col[:3], a)
    ctx.fill()


def beat_pulse(t, seg_key, sharp=10.0):
    s = TL.S[seg_key]
    if t < s.t0 or t > s.t1:
        return 0.0
    b = s.beat_at(t)
    f = b - math.floor(b)
    return math.exp(-f * sharp)


# ------------------------------------------------------------------ stage painters (screen + parallax)
def bg_baby(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#FFE6D6'), hexc('#FFD3C4'))
    ctx.save()
    layer(ctx, cam, 0.35, s)
    rnd = random.Random(1)
    for i in range(70):
        x, y = rnd.uniform(-1300, 1300), rnd.uniform(120, 1000)
        disc(ctx, (x, y), rnd.uniform(6, 13), hexc('#FFF2EA'), outline=False)
    # window with soft light
    rrect(ctx, 330, 330, 330, 380, 30)
    fill(ctx, hexc('#FFF6E8'))
    rrect(ctx, 345, 345, 300, 350, 22)
    fill(ctx, hexc('#CDEBF7'))
    ctx.rectangle(490, 345, 10, 350)
    fill(ctx, hexc('#FFF6E8'))
    ctx.rectangle(345, 515, 300, 10)
    fill(ctx, hexc('#FFF6E8'))
    ctx.restore()
    # crib mobile hanging from the top
    ctx.save()
    layer(ctx, cam, 0.7, s)
    top = 760
    cx, cy = -60, 430
    stroke_line(ctx, [(cx, top), (cx, cy + 30)], 3, hexc('#C9A27E'), outline=False)
    stroke_line(ctx, [(cx - 170, cy + 30), (cx + 170, cy + 30)], 5, hexc('#C9A27E'), outline=False)
    shapes = [('star', '#FFD25E'), ('moon', '#9AD0EC'), ('cloud', '#FFFFFF'), ('star', '#F7A1C4')]
    for i, (kind, col) in enumerate(shapes):
        a = t * 0.6 + i * math.pi / 2
        x = cx + 150 * math.cos(a)
        depth = math.sin(a)
        y = cy + 30 - 60 - 25 * (i % 2)
        stroke_line(ctx, [(cx + 150 * math.cos(a), cy + 30), (x, y)], 2, hexc('#C9A27E'), outline=False)
        sc = 1 + 0.15 * depth
        if kind == 'star':
            pts = []
            for k in range(10):
                rr = 26 * sc if k % 2 == 0 else 11 * sc
                aa = math.pi / 2 + k * math.pi / 5 + 0.3 * math.sin(t + i)
                pts.append((x + rr * math.cos(aa), y - 26 + rr * math.sin(aa)))
            poly(ctx, pts, hexc(col), ow=2.5)
        elif kind == 'moon':
            disc(ctx, (x, y - 26), 24 * sc, hexc(col), ow=2.5)
            disc(ctx, (x + 11 * sc, y - 18), 19 * sc, hexc('#FFE6D6'), outline=False)
        else:
            for dx, dy, r in ((-14, -26, 15), (2, -18, 19), (18, -26, 14)):
                disc(ctx, (x + dx * sc, y + dy * sc), r * sc, hexc(col), ow=2.5)
            for dx, dy, r in ((-14, -26, 15), (2, -18, 19), (18, -26, 14)):
                disc(ctx, (x + dx * sc, y + dy * sc), r * sc, hexc(col), outline=False)
    ctx.restore()


def bg_kid(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#FFF6C9'), hexc('#FFEBA8'))
    ctx.save()
    layer(ctx, cam, 0.45, s)
    # bunting
    for row, (y0, sag) in enumerate(((880, 60), (770, 45))):
        pts = []
        for i in range(19):
            x = -1400 + i * 155
            y = y0 - sag * math.sin(math.pi * ((i % 6) / 6.0))
            pts.append((x, y))
        cols = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#6A8EF7', '#FF9FF3']
        stroke_line(ctx, pts, 3, hexc('#A0826D'), outline=False)
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 70)
            sw = 4 * math.sin(t * 3 + i)
            poly(ctx, [a, b, (m[0] + sw, m[1])], hexc(cols[(i + row) % 5]), ow=2)
    # paper flowers (彩纸花)
    rnd = random.Random(5)
    for i in range(9):
        x = -1250 + i * 310 + rnd.uniform(-40, 40)
        y = rnd.uniform(380, 640)
        r = rnd.uniform(45, 75)
        col = hexc(['#FF6B8A', '#FFB347', '#7FD1F7', '#C59BFF', '#FF6B6B'][i % 5])
        rot_ = t * 0.4 * (1 if i % 2 else -1)
        for k in range(8):
            a = rot_ + k * math.pi / 4
            disc(ctx, (x + math.cos(a) * r * 0.62, y + math.sin(a) * r * 0.62), r * 0.45, col, ow=2.5)
        for k in range(8):
            a = rot_ + k * math.pi / 4
            disc(ctx, (x + math.cos(a) * r * 0.62, y + math.sin(a) * r * 0.62), r * 0.45, col, outline=False)
        disc(ctx, (x, y), r * 0.35, hexc('#FFE66D'), ow=2.5)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000)
    fill(ctx, hexc('#94D68A'))
    for i in range(-30, 31):
        ctx.rectangle(i * 90, -2000, 45, 2000)
        fill(ctx, hexc('#8CCE82'))
    ctx.restore()


def bg_school(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#8FD3F5'), hexc('#D6F0FB'))
    ctx.save()
    layer(ctx, cam, 0.25, s)
    # clouds
    for i, (x, y) in enumerate(((-700, 820), (300, 900), (900, 760))):
        x += (t * 8) % 2400 - 400
        for dx, dy, r in ((0, 0, 50), (55, 15, 60), (115, 0, 45)):
            disc(ctx, (x + dx, y + dy), r, hexc('#FFFFFF'), outline=False)
    # school building
    ctx.rectangle(-1100, 300, 2200, 300)
    fill(ctx, hexc('#F3E1C7'))
    ctx.rectangle(-1100, 590, 2200, 18)
    fill(ctx, hexc('#C96F5A'))
    for r in range(2):
        for i in range(16):
            ctx.rectangle(-1050 + i * 135, 360 + r * 115, 80, 70)
            fill(ctx, hexc('#9CC9E8'))
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.55, s)
    # 主席台 (rostrum) with a red banner, flagpole, loudspeaker
    ctx.rectangle(-520, 230, 1040, 150)
    fill(ctx, hexc('#E9D9BC'))
    ctx.rectangle(-560, 380, 1120, 26)
    fill(ctx, hexc('#B7472A'))
    ctx.rectangle(-460, 300, 920, 60)
    fill(ctx, hexc('#D7262E'))
    for i in range(7):
        disc(ctx, (-390 + i * 130, 330), 9, hexc('#FFD54A'), outline=False)
    stroke_line(ctx, [(760, 230), (760, 980)], 9, hexc('#9AA4AE'), outline=False)
    wave = [(760, 975)]
    for k in range(9):
        x = 760 + k * 22
        wave.append((x, 975 - 4 * math.sin(t * 6 - k * 0.7)))
    for k in range(8, -1, -1):
        x = 760 + k * 22
        wave.append((x, 870 - 4 * math.sin(t * 6 - k * 0.7)))
    poly(ctx, wave, hexc('#E5232B'), outline=False)
    # loudspeaker pole: the horn shakes with the counts
    pulse = 0.0
    for q in TL.find('count', seg='S3'):
        dt = t - q.t
        if 0 <= dt < 0.25:
            pulse = max(pulse, math.exp(-dt / 0.07))
    px = -760
    stroke_line(ctx, [(px, 230), (px, 860)], 9, hexc('#9AA4AE'), outline=False)
    for j, (dx, ang) in enumerate(((-1, 30), (1, -30))):
        ctx.save()
        ctx.translate(px + dx * 8, 860)
        ctx.rotate(math.radians(ang) * dx * -1)
        sc = 1 + 0.12 * pulse
        ctx.scale(sc, sc)
        poly(ctx, [(0, -10), (dx * 95, -48), (dx * 95, 48), (0, 10)], hexc('#DADFE4'), ow=3)
        poly(ctx, [(dx * 90, -44), (dx * 98, -48), (dx * 98, 48), (dx * 90, 44)], hexc('#8D969E'), outline=False)
        ctx.restore()
    if pulse > 0.05:
        for k in range(3):
            ctx.new_path()
            ctx.arc(px, 860, 120 + 30 * k + 30 * (1 - pulse), math.radians(-35), math.radians(35))
            ctx.set_source_rgba(*INK, 0.5 * pulse)
            ctx.set_line_width(4)
            ctx.stroke()
            ctx.new_path()
            ctx.arc(px, 860, 120 + 30 * k + 30 * (1 - pulse), math.radians(145), math.radians(215))
            ctx.stroke()
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000 + 330)
    fill(ctx, hexc('#7CC36B'))
    ctx.rectangle(-4000, -2000, 8000, 2000 + 40)
    fill(ctx, hexc('#D2553F'))
    for k in range(3):
        ctx.rectangle(-4000, -60 - k * 45 + 40, 8000, 4)
        fill(ctx, hexc('#F3E6DA'))
    ctx.rectangle(-4000, 200, 8000, 5)
    fill(ctx, hexc('#E9F5E2'))
    ctx.restore()


def bg_army(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#FFB04D'), hexc('#FFE7A0'))
    ctx.save()
    layer(ctx, cam, 0.15, s)
    # the scorching sun
    sx, sy = 520, 820
    for k in range(16):
        a = k * math.pi / 8 + t * 0.35
        r0, r1 = 150, 250 + 25 * math.sin(t * 5 + k)
        poly(ctx, [(sx + r0 * math.cos(a - 0.08), sy + r0 * math.sin(a - 0.08)),
                   (sx + r1 * math.cos(a), sy + r1 * math.sin(a)),
                   (sx + r0 * math.cos(a + 0.08), sy + r0 * math.sin(a + 0.08))], hexc('#FFD84D'), outline=False)
    disc(ctx, (sx, sy), 135, hexc('#FFF1A8'), outline=False)
    disc(ctx, (sx, sy), 118, hexc('#FFE15C'), outline=False)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.4, s)
    rnd = random.Random(9)
    for i in range(40):
        x = -1600 + i * 85
        r = rnd.uniform(60, 110)
        disc(ctx, (x, 250 + rnd.uniform(-20, 30)), r, hexc('#5E7C3A'), outline=False)
    ctx.rectangle(-3000, -100, 6000, 260)
    fill(ctx, hexc('#5E7C3A'))
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000 + 160)
    fill(ctx, hexc('#E2BE7E'))
    # heat haze lines
    for k in range(5):
        y = 60 + k * 22
        ctx.new_path()
        for i in range(60):
            x = -1500 + i * 50
            yy = y + 5 * math.sin(i * 0.8 + t * 6 + k)
            (ctx.move_to if i == 0 else ctx.line_to)(x, yy)
        ctx.set_source_rgba(1, 1, 1, 0.25)
        ctx.set_line_width(3)
        ctx.stroke()
    ctx.restore()


def bg_teen(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#160C2E'), hexc('#3B1366'))
    pulse = beat_pulse(t, 'S5', 6.0)
    ctx.save()
    layer(ctx, cam, 0.3, s)
    # light beams swinging on the beat
    S5 = TL.S['S5']
    b = S5.beat_at(t) if t > S5.t0 - 1 else 0
    for k, col in enumerate(('#FF2E97', '#21E6FF', '#FF2E97', '#21E6FF')):
        x0 = -900 + k * 600
        a = math.radians(90 + 25 * math.sin(b * math.pi / 2 + k * 1.3))
        ctx.save()
        ctx.translate(x0, 1150)
        g = cairo.LinearGradient(0, 0, math.cos(a) * -1300, -1300 * math.sin(a))
        g.add_color_stop_rgba(0, *hexc(col), 0.55 + 0.3 * pulse)
        g.add_color_stop_rgba(1, *hexc(col), 0.0)
        ctx.new_path()
        ctx.move_to(0, 0)
        d = 1400
        ctx.line_to(-math.cos(a - 0.09) * d, -math.sin(a - 0.09) * d)
        ctx.line_to(-math.cos(a + 0.09) * d, -math.sin(a + 0.09) * d)
        ctx.close_path()
        ctx.set_source(g)
        ctx.fill()
        ctx.restore()
    # disco ball
    bx, by = 0, 980
    stroke_line(ctx, [(bx, 1200), (bx, by + 70)], 3, hexc('#BBBBBB'), outline=False)
    disc(ctx, (bx, by), 72, hexc('#C9CCD6'), ow=3)
    for i in range(-4, 5):
        for j in range(-4, 5):
            x, y = bx + i * 15, by + j * 15
            if (x - bx) ** 2 + (y - by) ** 2 < 66 ** 2:
                v = 0.5 + 0.5 * math.sin(t * 4 + i * 1.7 + j * 2.3)
                ctx.rectangle(x - 6, y - 6, 12, 12)
                fill(ctx, mixc(hexc('#8A8FA3'), hexc('#FFFFFF'), v))
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.6, s)
    for side in (-1, 1):
        x = side * 820
        for k in range(2):
            rrect(ctx, x - 110, 40 + k * 230, 220, 220, 14)
            fill(ctx, hexc('#141019'))
            disc(ctx, (x, 150 + k * 230), 70 + 8 * pulse, hexc('#2C2638'), outline=False)
            disc(ctx, (x, 150 + k * 230), 28 + 6 * pulse, hexc('#4B4260'), outline=False)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000)
    fill(ctx, hexc('#1A1226'))
    for i in range(-30, 31):
        x = i * 120
        stroke_line(ctx, [(x, 0), (x * 1.8, -600)], 2.5, hexc('#7A2BD1'), outline=False)
    for k in range(6):
        y = -k * k * 12 - 4
        stroke_line(ctx, [(-4000, y), (4000, y)], 2.5, hexc('#21E6FF') if k % 2 else hexc('#FF2E97'), outline=False)
    # light spots from the ball sweeping the floor
    for k in range(6):
        x = 700 * math.sin(t * 1.3 + k * 1.1) + cam['cx']
        ctx.save()
        ctx.translate(x, -40 - 30 * (k % 3))
        ctx.scale(1, 0.25)
        disc(ctx, (0, 0), 40, hexc('#FFFFFF'), outline=False)
        ctx.restore()
    ctx.restore()


def bg_office(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#C6D3DC'), hexc('#DCE5EB'))
    ctx.save()
    layer(ctx, cam, 0.4, s)
    # fluorescent lamp (flickers a little)
    fl = 0.85 + 0.15 * (1 if math.sin(t * 37) > -0.9 else 0)
    rrect(ctx, -300, 1000, 600, 30, 10)
    fill(ctx, mixc(hexc('#B0B8BF'), hexc('#FFFFFF'), fl))
    # window with blinds
    rrect(ctx, 420, 380, 420, 420, 8)
    fill(ctx, hexc('#A9C3D3'))
    for k in range(14):
        ctx.rectangle(420, 390 + k * 29, 420, 14)
        fill(ctx, hexc('#E7EDF1'))
    # wall clock at 18:00
    disc(ctx, (-640, 760), 70, hexc('#FFFFFF'), ow=5)
    stroke_line(ctx, [(-640, 760), (-640, 810)], 7, INK, outline=False)
    stroke_line(ctx, [(-640, 760), (-640, 720)], 5, INK, outline=False)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.8, s)
    # cubicle partitions
    rrect(ctx, -900, 0, 1800, 470, 14)
    fill(ctx, hexc('#7F93A6'))
    rrect(ctx, -880, 20, 1760, 430, 10)
    fill(ctx, hexc('#8FA3B5'))
    for i in range(-3, 4):
        ctx.rectangle(i * 250 - 3, 20, 6, 430)
        fill(ctx, hexc('#7F93A6'))
    # sticky notes
    for i, (x, y, c) in enumerate(((-560, 330, '#FFE066'), (-480, 300, '#FF9AA2'), (520, 320, '#B5EAD7'))):
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(0.1 * (i - 1))
        ctx.rectangle(-30, -30, 60, 60)
        fill(ctx, hexc(c))
        ctx.restore()
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000)
    fill(ctx, hexc('#9AA3AB'))
    ctx.restore()


def bg_plaza(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#0E1B45'), hexc('#2F477F'))
    ctx.save()
    layer(ctx, cam, 0.1, s)
    rnd = random.Random(4)
    for i in range(60):
        x, y = rnd.uniform(-1200, 1200), rnd.uniform(600, 1100)
        a = 0.5 + 0.5 * math.sin(t * rnd.uniform(1, 3) + i)
        disc(ctx, (x, y), rnd.uniform(1.5, 3.5), (1, 1, 0.9), outline=False)
    disc(ctx, (-620, 930), 62, hexc('#FFF4C8'), outline=False)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.3, s)
    rnd = random.Random(8)
    x = -1800
    while x < 1800:
        w = rnd.uniform(140, 260)
        h = rnd.uniform(250, 620)
        ctx.rectangle(x, 120, w - 12, h)
        fill(ctx, hexc('#1C2754'))
        for yy in range(150, int(120 + h - 30), 48):
            for xx in range(int(x + 18), int(x + w - 40), 40):
                if rnd.random() < 0.45:
                    ctx.rectangle(xx, yy, 20, 26)
                    fill(ctx, hexc('#FFD27A'))
        x += w
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000 + 120)
    fill(ctx, hexc('#4C4F6B'))
    for i in range(-40, 41):
        stroke_line(ctx, [(i * 110, 120), (i * 200, -800)], 2, hexc('#5A5E7C'), outline=False)
    for k in range(5):
        stroke_line(ctx, [(-4000, 100 - k * k * 14), (4000, 100 - k * k * 14)], 2, hexc('#5A5E7C'), outline=False)
    ctx.restore()


def bg_park(ctx, t, cam, s):
    lin_grad(ctx, 0, H * s, hexc('#D4ECEA'), hexc('#F1F8F5'))
    ctx.save()
    layer(ctx, cam, 0.15, s)
    disc(ctx, (500, 860), 80, hexc('#FFF8E6'), outline=False)
    _pines(ctx, 7, 260, 0.55, hexc('#B6D6D2'), t)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 0.45, s)
    _pines(ctx, 3, 120, 0.85, hexc('#8DBDB6'), t)
    _mist(ctx, t, 230, 0.4)
    ctx.restore()
    ctx.save()
    layer(ctx, cam, 1.0, s)
    ctx.rectangle(-4000, -2000, 8000, 2000 + 60)
    fill(ctx, hexc('#C7DDD3'))
    ctx.save()
    ctx.translate(cam['cx'] * 0.0, 0)
    for i in range(-12, 13):
        ctx.save()
        ctx.translate(i * 160, -20)
        ctx.scale(1, 0.32)
        disc(ctx, (0, 0), 62, hexc('#B6CFC4'), outline=False)
        ctx.restore()
    ctx.restore()
    ctx.restore()


def _pines(ctx, seed, y0, sc, col, t):
    rnd = random.Random(seed)
    for i in range(12):
        x = -1700 + i * 310 + rnd.uniform(-60, 60)
        h = rnd.uniform(380, 620) * sc
        w = h * 0.42
        sway = 4 * math.sin(t * 0.7 + i)
        ctx.rectangle(x - 9 * sc, y0, 18 * sc, h * 0.3)
        fill(ctx, col)
        for k in range(4):
            yb = y0 + h * 0.2 + k * h * 0.2
            ww = w * (1 - k * 0.2)
            poly(ctx, [(x - ww, yb), (x + ww, yb), (x + sway * (k + 1) * 0.3, yb + h * 0.3)], col, outline=False)


def _mist(ctx, t, y0, a):
    for k in range(3):
        y = y0 + k * 110
        x = ((t * (14 + 6 * k)) % 900) - 450
        for j in range(-4, 5):
            ctx.save()
            ctx.translate(x + j * 900, y)
            ctx.scale(1, 0.12)
            ctx.new_path()
            ctx.arc(0, 0, 380, 0, 2 * math.pi)
            ctx.set_source_rgba(1, 1, 1, a * (0.8 - 0.2 * k))
            ctx.fill()
            ctx.restore()


PAINTERS = {'baby': bg_baby, 'kid': bg_kid, 'school': bg_school, 'army': bg_army, 'teen': bg_teen,
            'office': bg_office, 'plaza': bg_plaza, 'park': bg_park}


def background(ctx, t, cam, scale, rig):
    mix = stage_mix(t)
    for i, (st, w) in enumerate(mix):
        if w <= 0.002:
            continue
        if i == 0 or w >= 0.999:
            ctx.save()
            PAINTERS[st](ctx, t, cam, scale)
            ctx.restore()
        else:
            ctx.push_group()
            ctx.save()
            PAINTERS[st](ctx, t, cam, scale)
            ctx.restore()
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(w)
    # S9: memories — sepia veil + film flicker
    S9 = TL.S['S9']
    if S9.t0 <= t < S9.t1:
        ctx.set_source_rgba(*hexc('#E9C98F'), 0.28)
        ctx.paint()
    # S10: the park dissolves into white mist while he lies down
    S10 = TL.S['S10']
    if TL.t_stop <= t < TL.t_morph + 0.3:
        u = smooth((t - S10.t(1)) / (S10.t(6) - S10.t(1)))
        if t > TL.t_morph:
            u *= 1 - smooth((t - TL.t_morph) / 0.3)
        if u > 0:
            ctx.set_source_rgba(0.97, 0.98, 0.98, 0.75 * u)
            ctx.paint()


# ------------------------------------------------------------------ world-space props
def _mat(ctx, a=1.0):
    cols = ['#FFB5C2', '#B5E3FF', '#FFE59A', '#C8F2C2']
    for i in range(4):
        x = -330 + i * 165
        rrect(ctx, x, -26, 165, 34, 6)
        fill(ctx, hexc(cols[i]), a)
    ctx.rectangle(-330, 4, 660, 6)
    fill(ctx, hexc('#FFFFFF'), 0.6 * a)


def _toys(ctx):
    # rubber duck + stacking rings beside the mat
    x = 420
    for k, (w, c) in enumerate(((70, '#FF6B6B'), (58, '#FFD93D'), (46, '#4ECDC4'), (34, '#6A8EF7'))):
        rrect(ctx, x - w / 2, k * 22, w, 22, 10)
        fill(ctx, hexc(c))
    stroke_line(ctx, [(x, 0), (x, 110)], 8, hexc('#C9A27E'), outline=False)
    x = -440
    disc(ctx, (x, 30), 34, hexc('#FFD93D'), ow=3)
    disc(ctx, (x + 22, 72), 22, hexc('#FFD93D'), ow=3)
    poly(ctx, [(x + 40, 74), (x + 60, 68), (x + 40, 62)], hexc('#FF8C42'), ow=2)
    disc(ctx, (x + 26, 78), 3.5, INK, outline=False)


def world_back(ctx, t, cam, rig):
    w_baby = stage_weight(t, 'baby')
    if w_baby > 0.01 and t < TL.S['S2'].t0 + 1:
        _toys(ctx)
    w = stage_weight(t, 'plaza')
    if w > 0.01:
        _plaza_props(ctx, t, cam, w)
    w = stage_weight(t, 'army')
    if w > 0.01:
        _flagpole(ctx, t, w)


def _flagpole(ctx, t, a):
    x = 520
    ctx.push_group()
    stroke_line(ctx, [(x, 0), (x, 760)], 8, hexc('#8C8C8C'), outline=False)
    pts = [(x, 755)]
    for k in range(10):
        pts.append((x + k * 26, 755 - 6 * math.sin(t * 7 - k * 0.8)))
    for k in range(9, -1, -1):
        pts.append((x + k * 26, 625 - 6 * math.sin(t * 7 - k * 0.8)))
    poly(ctx, pts, hexc('#E5232B'), ow=2.5)
    disc(ctx, (x + 50, 715), 14, hexc('#FFD54A'), outline=False)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(a)


def _plaza_props(ctx, t, cam, a):
    hx = cam['cx']
    ctx.push_group()
    # street lamps with warm light cones
    for dx in (-760, 760):
        x = hx + dx
        g = cairo.RadialGradient(x, 560, 10, x, 560, 520)
        g.add_color_stop_rgba(0, 1.0, 0.86, 0.5, 0.45)
        g.add_color_stop_rgba(1, 1.0, 0.86, 0.5, 0.0)
        ctx.set_source(g)
        ctx.arc(x, 560, 520, 0, 2 * math.pi)
        ctx.fill()
        stroke_line(ctx, [(x, 0), (x, 560)], 12, hexc('#2A2D3E'), outline=False)
        disc(ctx, (x, 575), 32, hexc('#FFE4A3'), ow=4)
    # the big speaker box (pulses with the kick)
    S7 = TL.S['S7']
    pulse = beat_pulse(t, 'S7', 7.0)
    x = hx - 560
    rrect(ctx, x - 95, 0, 190, 300, 14)
    fill(ctx, hexc('#1E1E26'))
    disc(ctx, (x, 200), 62 + 7 * pulse, hexc('#3A3A48'), outline=False)
    disc(ctx, (x, 200), 26 + 5 * pulse, hexc('#5A5A6E'), outline=False)
    disc(ctx, (x, 80), 34, hexc('#3A3A48'), outline=False)
    for k in range(6):
        on = (k / 6.0) < (0.3 + 0.7 * pulse)
        ctx.rectangle(x - 70 + k * 24, 270, 18, 14)
        fill(ctx, hexc('#FF3B5C') if on and k > 3 else hexc('#4BE37A') if on else hexc('#333340'))
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(a)


def world_mid(ctx, t, cam, rig):
    # office chair: slides in under him at the end of S5, rolls away when he stands up
    S5, S6 = TL.S['S5'], TL.S['S6']
    if S5.t(14.4) <= t <= S6.t(11):
        x0 = rig.anchor[0]
        u_in = smoother((t - S5.t(14.6)) / (S6.t(0) - S5.t(14.6)))
        u_out = smoother((t - S6.t(8.5)) / (S6.t(10) - S6.t(8.5)))
        x = x0 - 1100 * (1 - u_in) - 500 * u_out
        _chair(ctx, x, rig.pr)


def _chair(ctx, x, pr):
    seat = (pr['thigh'] + pr['shin']) * 0.5
    stroke_line(ctx, [(x, 18), (x, seat - 10)], 14, hexc('#2C2F36'), outline=False)
    for dx in (-60, 0, 60):
        stroke_line(ctx, [(x, 22), (x + dx, 10)], 8, hexc('#2C2F36'), outline=False)
        disc(ctx, (x + dx, 9), 9, hexc('#15171C'), outline=False)
    rrect(ctx, x - 85, seat - 18, 170, 28, 12)
    fill(ctx, hexc('#3B3F4A'))
    rrect(ctx, x - 70, seat + 10, 140, 230, 26)
    fill(ctx, hexc('#3B3F4A'))


def world_front(ctx, t, cam, rig):
    w = stage_weight(t, 'baby')
    if w > 0.01:
        ctx.push_group()
        _mat(ctx)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(w)
    S5, S6, S7 = TL.S['S5'], TL.S['S6'], TL.S['S7']
    if S5.t(14.4) <= t <= S7.t(1.0):
        x0 = rig.anchor[0]
        u_in = smoother((t - S5.t(14.5)) / (S6.t(0) - 0.05 - S5.t(14.5)))
        u_out = smoother((t - S7.t(0) + 0.02) / (S7.spb * 0.8))
        x = x0 + 1300 * (1 - u_in) + 1500 * u_out
        _desk(ctx, t, x, rig.pr, typing=S6.t(0) <= t < S6.t(2))


def _desk(ctx, t, x, pr, typing):
    top = (pr['thigh'] + pr['shin']) * 0.78
    # monitor (screen-left), thermos (screen-right), keyboard in front
    mx = x - 250
    rrect(ctx, mx - 150, top + 70, 300, 200, 12)
    fill(ctx, hexc('#2B2F3A'))
    rrect(ctx, mx - 135, top + 85, 270, 170, 6)
    fill(ctx, hexc('#DCE9F5'))
    for k in range(5):
        ctx.rectangle(mx - 115, top + 225 - k * 28, 150 + 60 * ((k * 37) % 3) / 3, 12)
        fill(ctx, hexc('#9CB7D1'))
    stroke_line(ctx, [(mx, top + 70), (mx, top + 10)], 16, hexc('#2B2F3A'), outline=False)
    tx = x + 270
    rrect(ctx, tx - 26, top, 52, 120, 10)
    fill(ctx, hexc('#C0392B'))
    rrect(ctx, tx - 28, top + 108, 56, 22, 6)
    fill(ctx, hexc('#8E2A20'))
    for k in range(3):
        ph = t * 1.8 + k * 2.1
        yy = top + 140 + (ph % 2) * 50
        ctx.new_path()
        ctx.move_to(tx - 8 + k * 8, yy)
        ctx.curve_to(tx + 6 + k * 8, yy + 15, tx - 14 + k * 8, yy + 30, tx + k * 8, yy + 45)
        ctx.set_source_rgba(1, 1, 1, 0.55 * (1 - (ph % 2) / 2))
        ctx.set_line_width(4)
        ctx.stroke()
    # desk slab
    rrect(ctx, x - 520, top - 30, 1040, 34, 6)
    fill(ctx, hexc('#C79A6B'))
    ctx.rectangle(x - 500, -10, 1000, top - 25)
    fill(ctx, hexc('#B48557'))
    ctx.rectangle(x - 480, top - 120, 960, 6)
    fill(ctx, hexc('#9E7349'))
    # keyboard
    kb = top + 2
    rrect(ctx, x - 120, kb - 4, 240, 24, 5)
    fill(ctx, hexc('#E6E9EE'))
    for i in range(10):
        dn = typing and (int(t * 16) + i * 7) % 5 == 0
        ctx.rectangle(x - 110 + i * 22, kb + (2 if dn else 6), 16, 10)
        fill(ctx, hexc('#AEB6C2'))


# ------------------------------------------------------------------ the end
def title_card(ctx, t, scale):
    from .fonts import cjk_font
    ctx.set_source_rgb(0.04, 0.04, 0.05)
    ctx.paint()
    u = smoother((t - TL.t_black - 0.35) / 0.9)
    if u <= 0:
        return
    ctx.save()
    ctx.scale(scale, scale)
    ctx.select_font_face(cjk_font(), cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(104)
    s = '人生不过几个八拍'
    ext = ctx.text_extents(s)
    ctx.move_to(W / 2 - ext.x_advance / 2, H / 2 + 36)
    ctx.set_source_rgba(0.98, 0.96, 0.92, u)
    ctx.show_text(s)
    ctx.set_font_size(30)
    sub = '一 二 三 四 ， 五 六 七 八'
    ext = ctx.text_extents(sub)
    u2 = smoother((t - TL.t_black - 1.0) / 0.8)
    ctx.move_to(W / 2 - ext.x_advance / 2, H / 2 + 120)
    ctx.set_source_rgba(0.75, 0.73, 0.70, u2 * 0.9)
    ctx.show_text(sub)
    ctx.restore()
