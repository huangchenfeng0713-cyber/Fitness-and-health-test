"""Procedural drawables. All are stateless functions of their parameters."""
import math
import functools
import numpy as np
import skia
from .core import (C, PAL, paint_stroke, paint_fill, glow_path, radial_glow, poly_path,
                   smooth_path, clamp, smooth, ease_out, hash1, mix, mixc, font, adv)


# ===================================================================== stone
@functools.lru_cache(maxsize=8)
def stone_outline(seed=3, n=72):
    pts = []
    ph = [hash1(seed, k) * 6.283 for k in range(4)]
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + 0.10 * math.sin(2 * a + ph[0]) + 0.06 * math.sin(3 * a + ph[1]) \
            + 0.035 * math.sin(5 * a + ph[2]) + 0.02 * math.sin(7 * a + ph[3])
        x = math.cos(a) * r * 1.28
        y = math.sin(a) * r * 0.82
        if y > 0:
            y *= 0.78   # flatter base
        pts.append((x, y))
    return pts


def draw_stone(c, x, y, R, glow=0.0, alpha=1.0, lines=0.0, t=0.0, seed=3, line_col=None):
    """A quiet stone. glow: inner hierophanic light 0..1+, lines: contour lines."""
    if alpha <= 0.003:
        return
    pts = [(x + px * R, y + py * R) for px, py in stone_outline(seed)]
    path = smooth_path(pts, closed=True)
    # ground shadow
    sh = paint_fill((0, 0, 0), 0.55 * alpha, blur=R * 0.25)
    c.drawOval(skia.Rect.MakeXYWH(x - R * 1.5, y + R * 0.45, R * 3.0, R * 0.42), sh)
    # body
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeRadial(
        skia.Point(x - R * 0.35, y - R * 0.45), R * 1.9,
        [C(0.17, 0.17, 0.19, alpha), C(0.075, 0.078, 0.095, alpha), C(0.025, 0.026, 0.035, alpha)],
        [0.0, 0.45, 1.0]))
    c.drawPath(path, p)
    # rim light (cool moon from upper left)
    c.save()
    c.clipPath(path, doAntiAlias=True)
    rim = paint_stroke(PAL['moon'], 0.22 * alpha, R * 0.06, blur=R * 0.05)
    c.translate(R * 0.05, R * 0.06)
    c.drawPath(path, rim)
    c.restore()
    # texture: speckles, faint strata, soft highlight
    c.save()
    c.clipPath(path, doAntiAlias=True)
    for i in range(160):
        a0 = hash1(i, seed + 40) * 6.283
        rr = math.sqrt(hash1(i, seed + 41))
        px = x + math.cos(a0) * rr * R * 1.25
        py = y + math.sin(a0) * rr * R * 0.8
        tone = 0.25 + 0.5 * hash1(i, seed + 42)
        c.drawCircle(px, py, 0.6 + 1.6 * hash1(i, seed + 43), paint_fill((tone, tone, tone * 1.05), alpha * 0.10))
    for k in range(3):
        st = skia.Path()
        yy = y - R * 0.35 + k * R * 0.32
        st.moveTo(x - R * 1.4, yy + R * 0.1)
        st.cubicTo(x - R * 0.5, yy - R * 0.12, x + R * 0.4, yy + R * 0.18, x + R * 1.4, yy - R * 0.05)
        c.drawPath(st, paint_stroke((0.5, 0.52, 0.58), alpha * 0.08, 1.0))
    c.drawOval(skia.Rect.MakeXYWH(x - R * 0.85, y - R * 0.72, R * 0.9, R * 0.45), paint_fill((0.8, 0.82, 0.9), alpha * 0.07, blur=R * 0.15))
    c.restore()
    c.drawPath(path, paint_stroke((0.55, 0.58, 0.66), 0.25 * alpha, 1.2))
    # contour lines inside (sacred geometry of the stone)
    lc = line_col or PAL['gold']
    if lines > 0.003:
        for k in range(1, 7):
            s = 1 - k * 0.135
            off = (0.04 * k * R, -0.03 * k * R)
            q = [(x + off[0] * 0.3 + px * R * s, y + off[1] * 0.3 + py * R * s) for px, py in stone_outline(seed)]
            ph = 0.5 + 0.5 * math.sin(t * 2.0 - k * 0.7)
            a = alpha * lines * (0.25 + 0.75 * ph) * (1 - k * 0.08)
            glow_path(c, smooth_path(q, closed=True), lc, a, 1.1, glow=0.8, glow_w=6)
    if glow > 0.003:
        radial_glow(c, x, y - R * 0.05, R * (1.1 + 0.9 * glow), PAL['gold'], min(1.0, 0.55 * glow) * alpha)
        radial_glow(c, x, y - R * 0.05, R * 0.45, PAL['pale'], min(1.5, 0.9 * glow) * alpha)


# ===================================================================== small icons
def draw_log(c, x, y, s, alpha, col=PAL['moon']):
    if alpha <= 0.003:
        return
    w, h = 1.6 * s, 0.55 * s
    body = skia.Path()
    body.moveTo(x - w / 2, y - h / 2)
    body.lineTo(x + w / 2, y - h / 2)
    body.moveTo(x - w / 2, y + h / 2)
    body.lineTo(x + w / 2, y + h / 2)
    body.addArc(skia.Rect.MakeXYWH(x - w / 2 - h * 0.25, y - h / 2, h * 0.5, h), 90, 180)
    glow_path(c, body, col, alpha * 0.85, 1.4, 0.6, 6)
    # end grain: growth rings
    for k in range(6):
        rr = (k + 1) / 6
        ov = skia.Rect.MakeXYWH(x + w / 2 - h * 0.25 * rr, y - h / 2 * rr, h * 0.5 * rr, h * rr)
        c.drawOval(ov, paint_stroke(col, alpha * (0.9 - k * 0.08), 1.1))


def flame_path(x, y, s, t, seed=0):
    f1 = math.sin(t * 9.0 + seed) * 0.07 + math.sin(t * 13.7 + seed * 2) * 0.05
    top = (x + f1 * s, y - 1.35 * s)
    pts = [(x, y + 0.05 * s), (x - 0.42 * s, y - 0.25 * s), (x - 0.30 * s + f1 * s * 0.3, y - 0.75 * s),
           top, (x + 0.28 * s + f1 * s * 0.4, y - 0.72 * s), (x + 0.42 * s, y - 0.25 * s)]
    return smooth_path(pts, closed=True)


def draw_flame(c, x, y, s, alpha, t, seed=0, col=PAL['ember'], hot=PAL['pale']):
    if alpha <= 0.003:
        return
    radial_glow(c, x, y - 0.5 * s, 2.4 * s, col, 0.45 * alpha)
    c.drawPath(flame_path(x, y, s, t, seed), paint_fill(col, 0.85 * alpha, blur=s * 0.08))
    c.drawPath(flame_path(x, y - 0.02 * s, s * 0.55, t * 1.3, seed + 1), paint_fill(hot, 0.95 * alpha, blur=s * 0.05))


def draw_flame_line(c, x, y, s, alpha, t, col=PAL['moon']):
    if alpha <= 0.003:
        return
    glow_path(c, flame_path(x, y, s, t * 0.6), col, alpha, 1.4, 0.6, 6)
    glow_path(c, flame_path(x, y - 0.05 * s, s * 0.5, t * 0.8, 1), col, alpha * 0.7, 1.1, 0.4, 4)


def draw_bowl(c, x, y, s, alpha, t, col=PAL['moon'], steam=1.0, fill=None):
    if alpha <= 0.003:
        return
    rim = skia.Rect.MakeXYWH(x - s, y - 0.18 * s, 2 * s, 0.36 * s)
    body = skia.Path()
    body.moveTo(x - s, y)
    body.cubicTo(x - s, y + 0.75 * s, x + s, y + 0.75 * s, x + s, y)
    if fill is not None:
        bp = skia.Path(body)
        bp.close()
        c.drawPath(bp, paint_fill(fill, alpha * 0.6))
    glow_path(c, body, col, alpha, 1.4, 0.6, 6)
    c.drawOval(rim, paint_stroke(col, alpha, 1.3))
    # foot
    c.drawLine(x - 0.35 * s, y + 0.62 * s, x + 0.35 * s, y + 0.62 * s, paint_stroke(col, alpha * 0.8, 1.2))
    # rice mound
    mound = skia.Path()
    mound.moveTo(x - 0.8 * s, y - 0.02 * s)
    mound.cubicTo(x - 0.5 * s, y - 0.55 * s, x + 0.5 * s, y - 0.55 * s, x + 0.8 * s, y - 0.02 * s)
    c.drawPath(mound, paint_stroke(col, alpha * 0.7, 1.1))
    if steam > 0:
        for k in range(3):
            xx = x + (k - 1) * 0.35 * s
            pts = []
            for j in range(14):
                u = j / 13
                yy = y - 0.5 * s - u * 1.4 * s
                pts.append((xx + math.sin(u * 5 + t * 1.6 + k * 2) * 0.12 * s * (0.3 + u), yy))
            a = alpha * steam * 0.5 * (0.6 + 0.4 * math.sin(t * 1.3 + k))
            glow_path(c, smooth_path(pts), col, a, 1.0, 0.5, 5)


# ===================================================================== cosmic tree (建木)
@functools.lru_cache(maxsize=4)
def tree_segments(seed=11):
    """Trunk + three tiers of three arched branches (after the Sanxingdui bronze
    tree: a bird perches on each arch, a fruit hangs at each tip - nine birds).
    Returns list of (start, end, points, width, kind) in trunk-height units,
    base (0,0), top (0,-1)."""
    segs = []
    trunk = [(0.0, -u) for u in np.linspace(0, 1.0, 40)]
    segs.append((0.0, 0.55, trunk, 3.4, 'trunk'))
    # base: three mountain-like arches
    for k in (-1, 0, 1):
        pts = [(k * 0.09 + 0.07 * math.cos(math.pi * u), -0.07 * math.sin(math.pi * u)) for u in np.linspace(0, 1, 16)]
        segs.append((0.0, 0.12, pts, 2.2, 'branch'))
    tiers = [0.33, 0.56, 0.77]
    for ti, hy in enumerate(tiers):
        L = 0.30 - ti * 0.055
        for bi, (side, scale) in enumerate(((-1, 1.0), (1, 1.0), (1 if ti % 2 else -1, 0.5))):
            l = L * scale
            pts = []
            for j in range(28):
                u = j / 27
                xx = side * l * u
                yy = -hy - l * 0.42 * math.sin(math.pi * u * 0.92) + l * 0.30 * u ** 2
                pts.append((xx, yy - (0.025 if scale < 1 else 0)))
            start = 0.10 + 0.20 * ti + 0.04 * bi
            segs.append((start, start + 0.26, pts, 2.1 if scale == 1 else 1.6, 'branch'))
            crest = pts[11]
            segs.append((start + 0.22, start + 0.34, [(crest[0], crest[1] - 0.004)], side * (0.9 if scale == 1 else 0.7), 'bird'))
            segs.append((start + 0.24, start + 0.32, [pts[-1]], 0.0, 'fruit'))
            for q in (6, 18):
                segs.append((start + 0.1 + q / 27 * 0.2, start + 0.18 + q / 27 * 0.2, [pts[q]], 0.0, 'bud'))
    return segs


def draw_tree(c, x0, y0, height, grow, alpha, t, col=PAL['gold'], bird_col=PAL['pale'], flow=0.0):
    """grow 0..1 reveals the tree. flow: ascending/descending light motes."""
    if alpha <= 0.003:
        return
    for (a, b, pts, w, kind) in tree_segments():
        u = clamp((grow - a) / max(1e-6, b - a))
        if u <= 0:
            continue
        P = [(x0 + px * height, y0 + py * height) for px, py in pts]
        if kind in ('trunk', 'branch'):
            n = max(2, int(len(P) * u))
            path = smooth_path(P[:n])
            glow_path(c, path, col, alpha * (0.95 if kind == 'trunk' else 0.8), w, 1.0, 12)
        elif kind == 'bird':
            bx, by = P[0]
            s = height * 0.026 * ease_out(u) * abs(w)
            c.save()
            c.translate(bx, by)
            c.scale(1 if w > 0 else -1, 1)
            draw_bird_simple(c, 0, -s * 0.75, s, alpha * u, t, bird_col)
            c.restore()
        elif kind == 'fruit':
            bx, by = P[0]
            s = height * 0.016 * ease_out(u)
            fr = skia.Path()
            fr.moveTo(bx, by)
            fr.cubicTo(bx - s, by + s * 0.6, bx - s * 0.6, by + s * 1.8, bx, by + s * 2.0)
            fr.cubicTo(bx + s * 0.6, by + s * 1.8, bx + s, by + s * 0.6, bx, by)
            c.drawPath(fr, paint_fill(col, alpha * u * 0.85))
            radial_glow(c, bx, by + s, s * 3, col, alpha * u * 0.5)
        else:
            bx, by = P[0]
            radial_glow(c, bx, by, height * 0.012 * (1 + 0.3 * math.sin(t * 3 + bx)), col, alpha * u * 0.9)
    if flow > 0.003:
        top = y0 - height
        for i in range(40):
            up = i % 2 == 0
            sp = 0.10 + 0.08 * hash1(i, 3)
            ph = (hash1(i, 1) + t * sp * (1 if up else -1)) % 1.0
            yy = y0 - ph * height
            xx = x0 + math.sin(t * 1.3 + i) * height * 0.012
            colp = PAL['pale'] if up else PAL['sky']
            a = alpha * flow * math.sin(math.pi * ph) ** 0.7
            radial_glow(c, xx, yy, 7 + 5 * hash1(i, 9), colp, a)


def draw_bird_simple(c, x, y, s, alpha, t, col):
    """Stylised perched bird (head, beak, curled tail)."""
    if alpha <= 0.003 or s <= 0.2:
        return
    path = skia.Path()
    path.moveTo(x - 1.2 * s, y + 0.2 * s)
    path.cubicTo(x - 0.6 * s, y - 0.6 * s, x + 0.4 * s, y - 0.7 * s, x + 0.8 * s, y - 0.4 * s)   # back to head
    path.lineTo(x + 1.25 * s, y - 0.3 * s)                                                           # beak
    path.lineTo(x + 0.8 * s, y - 0.15 * s)
    path.cubicTo(x + 0.5 * s, y + 0.4 * s, x - 0.4 * s, y + 0.5 * s, x - 1.2 * s, y + 0.2 * s)
    c.drawPath(path, paint_fill(col, alpha * 0.9, blur=0.6))
    tail = skia.Path()
    tail.moveTo(x - 1.1 * s, y + 0.15 * s)
    tail.cubicTo(x - 2.0 * s, y - 0.2 * s, x - 2.2 * s, y + 1.0 * s, x - 1.5 * s, y + 0.9 * s)
    glow_path(c, tail, col, alpha * 0.8, max(1.0, s * 0.12), 0.6, 4)
    radial_glow(c, x, y, s * 3.2, col, alpha * 0.35)


# ===================================================================== heaven / earth
def draw_heaven(c, x, y, r, alpha, t, col=PAL['pale'], stars=28, rot=0.0):
    """天圆: double circle with 28 lunar-mansion stars."""
    if alpha <= 0.003:
        return
    c.drawCircle(x, y, r, paint_stroke(col, alpha * 0.9, 1.6))
    c.drawCircle(x, y, r * 0.86, paint_stroke(col, alpha * 0.45, 1.0))
    c.drawCircle(x, y, r, paint_stroke(col, alpha * 0.3, 5, blur=10))
    for i in range(stars):
        a = rot + 2 * math.pi * i / stars
        rr = r * 0.93
        tw = 0.6 + 0.4 * math.sin(t * 2.3 + i * 1.7)
        radial_glow(c, x + math.cos(a) * rr, y + math.sin(a) * rr, 7, col, alpha * tw)


def draw_earth(c, x, y, s, alpha, col=PAL['gold']):
    """地方: square with nine-fold grid (九州)."""
    if alpha <= 0.003:
        return
    r = skia.Rect.MakeXYWH(x - s / 2, y - s / 2, s, s)
    c.drawRect(r, paint_stroke(col, alpha * 0.9, 1.6))
    c.drawRect(r, paint_stroke(col, alpha * 0.25, 6, blur=10))
    for k in (1, 2):
        c.drawLine(x - s / 2 + s * k / 3, y - s / 2, x - s / 2 + s * k / 3, y + s / 2, paint_stroke(col, alpha * 0.45, 1.0))
        c.drawLine(x - s / 2, y - s / 2 + s * k / 3, x + s / 2, y - s / 2 + s * k / 3, paint_stroke(col, alpha * 0.45, 1.0))


# ===================================================================== mandala
def draw_mandala(c, x, y, R, alpha, t, rot=0.0, col=PAL['gold'], pulse=0.0, fold=9):
    if alpha <= 0.003:
        return
    c.save()
    c.translate(x, y)
    c.rotate(math.degrees(rot))
    for k, rr in enumerate([0.18, 0.32, 0.47, 0.62, 0.80, 1.0]):
        a = alpha * (0.85 - k * 0.07)
        c.drawCircle(0, 0, R * rr, paint_stroke(col, a, 1.3 if k % 2 == 0 else 0.9))
    # radial spokes
    path = skia.Path()
    for i in range(fold * 4):
        ang = 2 * math.pi * i / (fold * 4)
        r0 = R * (0.32 if i % 4 else 0.18)
        path.moveTo(math.cos(ang) * r0, math.sin(ang) * r0)
        path.lineTo(math.cos(ang) * R, math.sin(ang) * R)
    c.drawPath(path, paint_stroke(col, alpha * 0.35, 0.8))
    # petals (arcs between circles)
    pet = skia.Path()
    for i in range(fold):
        ang = 2 * math.pi * i / fold
        a2 = ang + math.pi / fold
        p0 = (math.cos(ang) * R * 0.47, math.sin(ang) * R * 0.47)
        p1 = (math.cos(a2) * R * 0.80, math.sin(a2) * R * 0.80)
        p2 = (math.cos(ang + 2 * math.pi / fold) * R * 0.47, math.sin(ang + 2 * math.pi / fold) * R * 0.47)
        pet.moveTo(*p0)
        pet.quadTo(p1[0], p1[1], p2[0], p2[1])
        pet.moveTo(math.cos(a2) * R * 0.62, math.sin(a2) * R * 0.62)
        pet.lineTo(math.cos(ang) * R * 1.0, math.sin(ang) * R * 1.0)
    glow_path(c, pet, col, alpha * 0.8, 1.2, 0.8, 8)
    # triangle star (nine-pointed)
    star = skia.Path()
    for j in range(3):
        pts = []
        for i in range(3):
            ang = 2 * math.pi * (i / 3 + j / 9) - math.pi / 2
            pts.append((math.cos(ang) * R * 0.62, math.sin(ang) * R * 0.62))
        star.addPoly([skia.Point(*p) for p in pts], True)
    glow_path(c, star, col, alpha * 0.55, 1.0, 0.6, 6)
    if pulse > 0.003:
        c.drawCircle(0, 0, R * (1.0 + 0.25 * (1 - pulse)), paint_stroke(PAL['pale'], alpha * pulse * 0.6, 2.0, blur=4))
    c.restore()


# ===================================================================== oracle bone
PLASTRON_W = [(-1.00, 0.30), (-0.93, 0.42), (-0.75, 0.51), (-0.52, 0.56), (-0.40, 0.60), (-0.33, 0.67),
              (-0.18, 0.70), (-0.02, 0.70), (0.10, 0.67), (0.17, 0.59), (0.38, 0.55), (0.66, 0.47),
              (0.88, 0.36), (0.99, 0.21)]


@functools.lru_cache(maxsize=2)
def plastron_outline():
    """Turtle plastron (腹甲) outline with bridge wings; unit coords, y down."""
    right = [(w, y) for y, w in PLASTRON_W]
    left = [(-w, y) for y, w in reversed(PLASTRON_W)]
    pts = [(0.0, -0.975)] + right + [(0.10, 0.97), (0.0, 0.90), (-0.10, 0.97)] + left
    # densify and roughen the edge a little (worn bone)
    out = []
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        for k in range(3):
            u = k / 3
            px, py = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            j = len(out)
            out.append((px * (1 + 0.012 * math.sin(j * 1.7) + 0.008 * math.sin(j * 4.3)), py))
    return out


@functools.lru_cache(maxsize=2)
def plastron_hollows():
    """Crack origins (where the hollows were burned), either side of the midline."""
    out = []
    rows = [-0.66, -0.44, -0.22, 0.02, 0.26, 0.50, 0.72]
    for ri, yy in enumerate(rows):
        xs = (0.16, 0.36) if 0 < ri < 6 else (0.18,)
        for xx in xs:
            for s in (-1, 1):
                out.append((s * xx, yy))
    return out


@functools.lru_cache(maxsize=64)
def crack_poly(seed, length=0.30, side=1):
    """A 卜-shaped crack: vertical stem + side branch. unit coords."""
    rnd = lambda k: hash1(seed * 31 + k, 5) - 0.5
    stem = [(0.0, -length * 0.5)]
    n = 9
    for i in range(1, n + 1):
        u = i / n
        stem.append((rnd(i) * 0.03, -length * 0.5 + u * length))
    br = [(stem[3][0], stem[3][1])]
    for i in range(1, 7):
        u = i / 6
        br.append((stem[3][0] + side * u * length * 0.55 + rnd(20 + i) * 0.02,
                   stem[3][1] + u * length * 0.18 + rnd(30 + i) * 0.02))
    return tuple(stem), tuple(br)


def draw_plastron(c, x, y, s, alpha, heat=0.0, t=0.0, cracks=(), col=PAL['bone']):
    """cracks: list of (hollow_index, progress 0..1, flash 0..1, side)."""
    if alpha <= 0.003:
        return
    pts = [(x + px * s, y + py * s) for px, py in plastron_outline()]
    path = smooth_path(pts, closed=True)
    # body fill: warm bone with heat
    p = skia.Paint(AntiAlias=True)
    base = mixc((0.20, 0.17, 0.13), (0.55, 0.30, 0.14), clamp(heat))
    p.setShader(skia.GradientShader.MakeRadial(
        skia.Point(x, y + s * 0.6), s * 1.8,
        [C(*mixc(base, (1.0, 0.6, 0.25), heat * 0.6), alpha), C(*base, alpha), C(0.06, 0.05, 0.04, alpha)],
        [0.0, 0.55, 1.0]))
    c.drawPath(path, p)
    glow_path(c, path, col, alpha * 0.8, 1.6, 0.7, 8)
    # bone texture: faint growth lines following the outline
    for k in range(1, 4):
        q = [(x + px * s * (1 - k * 0.07), y + py * s * (1 - k * 0.06)) for px, py in plastron_outline()]
        c.drawPath(smooth_path(q, closed=True), paint_stroke(col, alpha * 0.10, 0.8))
    # scute sulci: midline + transverse seams
    seam = skia.Path()
    seam.moveTo(x, y - s * 0.97)
    seam.lineTo(x, y + s * 0.90)
    for yy, ww, bow in [(-0.80, 0.42, -0.06), (-0.55, 0.57, 0.05), (-0.12, 0.70, 0.04), (0.30, 0.56, 0.05), (0.66, 0.47, 0.06)]:
        seam.moveTo(x - ww * s, y + yy * s)
        seam.quadTo(x, y + (yy + bow) * s, x + ww * s, y + yy * s)
    c.drawPath(seam, paint_stroke(col, alpha * 0.32, 1.1))
    # cracks (卜兆): vertical stem, branch toward the midline; scorched origin
    hol = plastron_hollows()
    for (hi, prog, flash, side) in cracks:
        if prog <= 0:
            continue
        hx, hy = hol[hi % len(hol)]
        side = -1 if hx > 0 else 1
        stem, br = crack_poly(hi * 7 + 3, 0.46 if hi == 7 else 0.28, side)
        ox = x + hx * s
        oy = y + hy * s
        radial_glow(c, ox, oy, s * 0.07, (0.02, 0.01, 0.0), alpha * 0.8 * min(1, prog * 3))
        P = [(ox + px * s, oy + py * s) for px, py in stem]
        Q = [(ox + px * s, oy + py * s) for px, py in br]
        n1 = max(2, int(len(P) * clamp(prog * 1.6)))
        n2 = max(2, int(len(Q) * clamp(prog * 1.6 - 0.6)))
        hotc = mixc(PAL['ember'], PAL['pale'], flash)
        ap = poly_path(P[:n1])
        c.drawPath(ap, paint_stroke((0.03, 0.02, 0.01), alpha, 2.4))
        glow_path(c, ap, hotc, alpha * (0.75 + 0.9 * flash), 2.0, 1.4 + 2 * flash, 12)
        if prog > 0.4:
            bp = poly_path(Q[:n2])
            c.drawPath(bp, paint_stroke((0.03, 0.02, 0.01), alpha, 2.2))
            glow_path(c, bp, hotc, alpha * (0.75 + 0.9 * flash), 1.8, 1.4 + 2 * flash, 12)


# ===================================================================== 圜丘
TIER_R = (0.43, 0.715, 1.0)    # 3:5:7 tier radii (upper, middle, lower)


def yuanqiu_ring_radius(n):
    """Outer radius of paving ring n (1..27), unit = lower tier radius."""
    r_c = 0.035
    if n <= 9:
        return r_c + (TIER_R[0] - 0.03 - r_c) * n / 9
    if n <= 18:
        a = TIER_R[0]
        return a + (TIER_R[1] - 0.03 - a) * (n - 9) / 9
    a = TIER_R[1]
    return a + (TIER_R[2] - 0.03 - a) * (n - 18) / 9


@functools.lru_cache(maxsize=32)
def yuanqiu_ring_path(n, R):
    """Ring n of the paving: circle + 9n slab joints."""
    r1 = yuanqiu_ring_radius(n) * R
    r0 = (yuanqiu_ring_radius(n - 1) if n > 1 else 0.035) * R
    if n in (10, 19):
        r0 = (TIER_R[0] if n == 10 else TIER_R[1]) * R
    p = skia.Path()
    p.addCircle(0, 0, r1)
    m = 9 * n
    for i in range(m):
        a = 2 * math.pi * (i + 0.5) / m
        p.moveTo(math.cos(a) * r0, math.sin(a) * r0)
        p.lineTo(math.cos(a) * r1, math.sin(a) * r1)
    return p


def draw_yuanqiu(c, x, y, R, t, rings=27.0, rails=0.0, stairs=0.0, walls=0.0, alpha=1.0,
                 col=PAL['pale'], accent=PAL['gold'], rot=0.0, center_glow=0.0, pulse_ring=-1, pulse=0.0):
    """Top-down 圜丘. rings: number of paving rings revealed (fractional)."""
    if alpha <= 0.003:
        return
    c.save()
    c.translate(x, y)
    c.rotate(math.degrees(rot))
    # walls: outer square, inner circle (天圆地方)
    if walls > 0.003:
        wa = alpha * walls
        sq = R * 1.62
        rr = skia.Rect.MakeXYWH(-sq, -sq, 2 * sq, 2 * sq)
        c.drawRect(rr, paint_stroke(accent, wa * 0.8, 2.0))
        c.drawRect(rr, paint_stroke(accent, wa * 0.25, 7, blur=12))
        c.drawCircle(0, 0, R * 1.30, paint_stroke(accent, wa * 0.8, 2.0))
        c.drawCircle(0, 0, R * 1.30, paint_stroke(accent, wa * 0.25, 7, blur=12))
        for k in range(4):     # 棂星门: three gates each side
            ang = k * math.pi / 2
            for g in (-1, 0, 1):
                for rad in (R * 1.30, sq):
                    cx = math.cos(ang) * rad - math.sin(ang) * g * R * 0.09
                    cy = math.sin(ang) * rad + math.cos(ang) * g * R * 0.09
                    c.drawCircle(cx, cy, R * 0.012, paint_fill(accent, wa))
    # tier fills
    for k, tr in enumerate(TIER_R[::-1]):
        lv = clamp(rings - (18, 9, 0)[k])
        if lv > 0:
            c.drawCircle(0, 0, tr * R, paint_fill((0.08, 0.10, 0.16), alpha * 0.55 * lv))
    # paving rings
    full = int(rings)
    for n in range(1, min(27, full + 1) + 1):
        u = 1.0 if n <= full else rings - full
        if u <= 0:
            continue
        p = yuanqiu_ring_path(n, round(R, 1))
        a = alpha * (0.55 + 0.45 * (1 if n % 9 == 0 else 0.6)) * u
        if n == pulse_ring:
            a = min(1.5, a + pulse)
        c.drawPath(p, paint_stroke(col, a * 0.75, 0.8 if n < 27 else 1.2))
        if u < 1:
            r1 = yuanqiu_ring_radius(n) * R
            c.drawCircle(0, 0, r1, paint_stroke(accent, alpha * (1 - u) * 1.2, 3, blur=6))
    # tier edges + balustrades (72 / 108 / 180 posts)
    if rails > 0.003:
        for k, (tr, nposts) in enumerate(zip(TIER_R, (72, 108, 180))):
            ra = alpha * clamp(rails * 3 - k)
            if ra <= 0:
                continue
            c.drawCircle(0, 0, tr * R, paint_stroke(accent, ra, 1.8))
            c.drawCircle(0, 0, tr * R, paint_stroke(accent, ra * 0.3, 6, blur=8))
            pts = []
            for i in range(nposts):
                a = 2 * math.pi * i / nposts
                pts.append(skia.Point(math.cos(a) * tr * R, math.sin(a) * tr * R))
            pp = paint_stroke(accent, ra, max(2.0, R * 0.008))
            c.drawPoints(skia.Canvas.kPoints_PointMode, pts, pp)
    # stairs: four flights, nine steps per tier
    if stairs > 0.003:
        sa = alpha * stairs
        for k in range(4):
            c.save()
            c.rotate(90 * k)
            w = R * 0.05
            for tier in range(3):
                r_in = (TIER_R[tier] if tier < 3 else 1) * R
                r_out = r_in + R * 0.07
                c.drawRect(skia.Rect.MakeLTRB(-w, r_in, w, r_out), paint_fill((0.05, 0.06, 0.1), sa * 0.9))
                for s in range(10):
                    yy = r_in + (r_out - r_in) * s / 9
                    c.drawLine(-w, yy, w, yy, paint_stroke(accent, sa * 0.7, 0.8))
                c.drawRect(skia.Rect.MakeLTRB(-w, r_in, w, r_out), paint_stroke(accent, sa, 1.0))
            c.restore()
    # 天心石
    radial_glow(c, 0, 0, R * (0.06 + 0.25 * center_glow), PAL['pale'], alpha * (0.5 + center_glow))
    c.drawCircle(0, 0, R * 0.035, paint_stroke(accent, alpha, 1.5))
    c.restore()


# ===================================================================== ancestral tablet (神主牌)
def tablet_path(x, y, w, h):
    p = skia.Path()
    top = y - h / 2
    p.moveTo(x - w / 2, y + h / 2)
    p.lineTo(x - w / 2, top + w * 0.35)
    p.cubicTo(x - w / 2, top + w * 0.05, x - w * 0.25, top, x, top - w * 0.06)
    p.cubicTo(x + w * 0.25, top, x + w / 2, top + w * 0.05, x + w / 2, top + w * 0.35)
    p.lineTo(x + w / 2, y + h / 2)
    p.close()
    return p


def draw_tablet(c, x, y, w, h, alpha, glow=0.0, text=None, text_alpha=1.0, col=PAL['gold'],
                text_size=None, dot=0.0, dot_flash=0.0, faint_lines=True):
    if alpha <= 0.003:
        return
    # base/plinth
    c.drawRect(skia.Rect.MakeXYWH(x - w * 0.75, y + h / 2, w * 1.5, h * 0.09), paint_fill((0.12, 0.05, 0.03), alpha))
    c.drawRect(skia.Rect.MakeXYWH(x - w * 0.75, y + h / 2, w * 1.5, h * 0.09), paint_stroke(col, alpha * 0.6, 1.0))
    body = tablet_path(x, y, w, h)
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(x - w / 2, y), skia.Point(x + w / 2, y)],
        [C(0.20, 0.07, 0.05, alpha), C(0.32, 0.11, 0.07, alpha), C(0.16, 0.05, 0.04, alpha)],
        [0.0, 0.45, 1.0]))
    c.drawPath(body, p)
    glow_path(c, body, col, alpha * 0.85, 1.5, 0.6 + glow, 8)
    inner = tablet_path(x, y + h * 0.02, w * 0.80, h * 0.86)
    c.drawPath(inner, paint_stroke(col, alpha * 0.4, 0.9))
    if glow > 0.003:
        radial_glow(c, x, y, w * 2.6 * (0.8 + glow * 0.5), PAL['gold'], alpha * glow * 0.5)
    if text:
        ts = text_size or w * 0.5
        f = font('serif_sb', ts)
        n = len(text)
        y0 = y - (n * ts * 1.1) / 2 + ts * 0.2
        for i, ch in enumerate(text):
            cw = adv('serif_sb', ts, ch)
            c.drawString(ch, x - cw / 2, y0 + (i + 0.8) * ts * 1.1, f, paint_fill(col, alpha * text_alpha * 0.35, blur=ts * 0.12))
            c.drawString(ch, x - cw / 2, y0 + (i + 0.8) * ts * 1.1, f, paint_fill(col, alpha * text_alpha))
        # cinnabar dot over the last 王 -> 主
        if dot > 0:
            lx = x
            ly = y0 + (n - 1 + 0.8) * ts * 1.1 - ts * 0.86
            d = ts * 0.13 * ease_out(dot)
            drop = skia.Path()
            drop.moveTo(lx - d * 0.9, ly - d * 0.7)
            drop.cubicTo(lx + d * 0.3, ly - d * 1.4, lx + d * 1.6, ly + d * 0.2, lx + d * 0.3, ly + d * 1.0)
            drop.cubicTo(lx - d * 0.4, ly + d * 1.2, lx - d * 1.3, ly - d * 0.1, lx - d * 0.9, ly - d * 0.7)
            c.drawPath(drop, paint_fill(PAL['cinnabar'], alpha))
            if dot_flash > 0:
                radial_glow(c, lx, ly, ts * (0.6 + 1.6 * dot_flash), PAL['cinnabar'], alpha * dot_flash)
                radial_glow(c, lx, ly, ts * 0.35, PAL['pale'], alpha * dot_flash)
    elif faint_lines:
        for k in range(5):
            yy = y - h * 0.28 + k * h * 0.12
            c.drawLine(x, yy, x, yy + h * 0.07, paint_stroke(col, alpha * 0.35, w * 0.08))


def draw_candle(c, x, y, s, alpha, t, seed=0):
    if alpha <= 0.003:
        return
    c.drawRect(skia.Rect.MakeXYWH(x - s * 0.18, y, s * 0.36, s * 1.6), paint_fill((0.55, 0.10, 0.08), alpha))
    c.drawRect(skia.Rect.MakeXYWH(x - s * 0.18, y, s * 0.36, s * 1.6), paint_stroke(PAL['gold'], alpha * 0.4, 0.8))
    draw_flame(c, x, y - s * 0.02, s * 0.32, alpha, t, seed)


def draw_censer(c, x, y, s, alpha, col=PAL['gold']):
    """香炉 / 鼎: round belly, two upright ears, three legs."""
    if alpha <= 0.003:
        return
    body = skia.Path()
    body.moveTo(x - s, y - s * 0.25)
    body.cubicTo(x - s * 1.02, y + s * 0.65, x + s * 1.02, y + s * 0.65, x + s, y - s * 0.25)
    body.close()
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeLinear([skia.Point(x - s, y), skia.Point(x + s, y)],
                                               [C(0.10, 0.12, 0.10, alpha), C(0.22, 0.24, 0.18, alpha), C(0.08, 0.09, 0.08, alpha)], [0, 0.5, 1]))
    c.drawPath(body, p)
    glow_path(c, body, col, alpha * 0.8, 1.3, 0.5, 6)
    c.drawLine(x - s * 1.05, y - s * 0.25, x + s * 1.05, y - s * 0.25, paint_stroke(col, alpha, 2.0))
    for sx in (-1, 1):
        ear = skia.Rect.MakeXYWH(x + sx * s * 0.62 - s * 0.12, y - s * 0.62, s * 0.24, s * 0.37)
        c.drawRoundRect(ear, s * 0.05, s * 0.05, paint_stroke(col, alpha * 0.9, 1.4))
    for lx in (-0.55, 0.0, 0.55):
        c.drawLine(x + lx * s, y + s * 0.45, x + lx * s * 1.2, y + s * 0.85, paint_stroke(col, alpha * 0.9, 2.2))
    # band of cloud-thunder pattern (云雷纹), simplified as a meander
    band = skia.Path()
    yy = y + s * 0.02
    for i in range(10):
        bx = x - s * 0.8 + i * s * 0.16
        band.moveTo(bx, yy)
        band.lineTo(bx, yy - s * 0.08)
        band.lineTo(bx + s * 0.1, yy - s * 0.08)
        band.lineTo(bx + s * 0.1, yy - s * 0.02)
        band.lineTo(bx + s * 0.04, yy - s * 0.02)
    c.drawPath(band, paint_stroke(col, alpha * 0.5, 0.9))


def incense_path(x, y, h, t, seed=0, sway=1.0):
    pts = []
    for j in range(40):
        u = j / 39
        yy = y - u * h
        xx = x + (math.sin(u * 7 + t * 0.9 + seed) * 0.6 + math.sin(u * 13 - t * 1.4 + seed * 2) * 0.35) \
            * h * 0.035 * u * sway
        pts.append((xx, yy))
    return smooth_path(pts)


def draw_incense(c, x, y, h, alpha, t, seed=0, stick=40, smoke=1.0, col=PAL['moon']):
    if alpha <= 0.003:
        return
    c.drawLine(x, y, x, y - stick, paint_stroke((0.55, 0.15, 0.10), alpha, 2.2))
    radial_glow(c, x, y - stick, 9, PAL['ember'], alpha)
    radial_glow(c, x, y - stick, 3, PAL['pale'], alpha)
    if smoke > 0:
        glow_path(c, incense_path(x, y - stick - 2, h * smoke, t, seed), col, alpha * 0.35, 1.2, 1.2, 6)


# ===================================================================== flower (清明)
def draw_chrysanthemum(c, x, y, r, alpha, t, col=PAL['moon']):
    """Layered narrow petals curving inward, seen at a slight angle."""
    if alpha <= 0.003:
        return
    radial_glow(c, x, y, r * 1.6, col, alpha * 0.18)
    sway = math.sin(t * 0.7 + x * 0.01) * 0.03
    for layer in range(4):
        n = 22 - layer * 3
        L = r * (1.0 - layer * 0.2)
        wdt = r * (0.11 - layer * 0.012)
        shade = 0.55 + 0.15 * layer
        for i in range(n):
            a = 2 * math.pi * (i + layer * 0.37) / n + sway
            c.save()
            c.translate(x, y)
            c.scale(1, 0.82)
            c.rotate(math.degrees(a))
            pet = skia.Path()
            pet.moveTo(0, 0)
            pet.cubicTo(L * 0.3, -wdt, L * 0.8, -wdt * 1.1, L, -wdt * 0.2)
            pet.cubicTo(L * 0.8, wdt * 0.6, L * 0.3, wdt, 0, 0)
            c.drawPath(pet, paint_fill(mixc((0.25, 0.25, 0.22), col, shade), alpha * 0.92))
            c.drawPath(pet, paint_stroke(col, alpha * 0.35, 0.7))
            c.restore()
    radial_glow(c, x, y, r * 0.35, (1.0, 0.9, 0.6), alpha * 0.7)


def draw_stele(c, x, y, w, h, alpha, col=PAL['moon']):
    p = skia.Path()
    p.moveTo(x - w / 2, y)
    p.lineTo(x - w / 2, y - h + w * 0.25)
    p.quadTo(x - w / 2, y - h, x, y - h - w * 0.05)
    p.quadTo(x + w / 2, y - h, x + w / 2, y - h + w * 0.25)
    p.lineTo(x + w / 2, y)
    p.close()
    g = skia.Paint(AntiAlias=True)
    g.setShader(skia.GradientShader.MakeLinear([skia.Point(x - w / 2, y), skia.Point(x + w / 2, y)],
                                               [C(0.10, 0.11, 0.13, alpha), C(0.16, 0.17, 0.20, alpha), C(0.07, 0.08, 0.10, alpha)], [0, 0.4, 1]))
    c.drawPath(p, g)
    c.drawPath(p, paint_stroke(col, alpha * 0.5, 1.2))
    inner = skia.Rect.MakeLTRB(x - w * 0.36, y - h + w * 0.30, x + w * 0.36, y - h * 0.08)
    c.drawRect(inner, paint_stroke(col, alpha * 0.18, 1.0))
    ts = w * 0.24
    f = font('kai', ts)
    for k, ch in enumerate('音容宛在'):
        cw = adv('kai', ts, ch)
        yy = y - h + w * 0.30 + h * 0.12 + k * ts * 1.5
        c.drawString(ch, x - cw / 2, yy + ts * 0.85, f, paint_fill(PAL['gold'], alpha * 0.55))


# ===================================================================== lotus lantern
def draw_lantern(c, x, y, s, alpha, t, seed=0, col=PAL['ember'], refl=0.0):
    if alpha <= 0.003 or s < 0.5:
        return
    fl = 0.85 + 0.15 * math.sin(t * 7 + seed * 3)
    radial_glow(c, x, y - s * 0.5, s * 4.0, col, alpha * 0.55 * fl)
    # petals
    for i in range(5):
        a = math.pi * (0.1 + 0.8 * i / 4)
        p = skia.Path()
        bx = x + math.cos(a) * s * 0.9
        p.moveTo(x + math.cos(a) * s * 0.3, y)
        p.quadTo(bx, y - s * 0.2, x + math.cos(a) * s * 1.05, y - s * (0.7 + 0.2 * math.sin(a)))
        c.drawPath(p, paint_stroke(PAL['pale'], alpha * 0.8, max(0.8, s * 0.08)))
    c.drawOval(skia.Rect.MakeXYWH(x - s, y - s * 0.12, 2 * s, s * 0.3), paint_fill(mixc(col, PAL['pale'], 0.3), alpha * 0.9))
    radial_glow(c, x, y - s * 0.35, s * 0.7, PAL['pale'], alpha * fl)
    if refl > 0:
        for k in range(4):
            yy = y + s * (0.6 + k * 0.55)
            ww = s * (1.4 - k * 0.2) * (1 + 0.2 * math.sin(t * 3 + k + seed))
            c.drawLine(x - ww / 2, yy, x + ww / 2, yy, paint_stroke(col, alpha * refl * (0.6 - k * 0.13), max(1.0, s * 0.12), blur=s * 0.08))


# ===================================================================== sun bird (金沙太阳神鸟)
def draw_sunbird(c, x, y, R, alpha, t, rot=0.0, col=PAL['gold']):
    if alpha <= 0.003:
        return
    c.save()
    c.translate(x, y)
    radial_glow(c, 0, 0, R * 1.6, col, alpha * 0.35)
    c.drawCircle(0, 0, R, paint_stroke(col, alpha * 0.9, 1.6))
    c.drawCircle(0, 0, R, paint_stroke(col, alpha * 0.3, 7, blur=10))
    # inner sun: 12 swirling rays (rotate one way)
    c.save()
    c.rotate(math.degrees(rot * 1.6))
    rays = skia.Path()
    for i in range(12):
        a = 2 * math.pi * i / 12
        p0 = (math.cos(a) * R * 0.16, math.sin(a) * R * 0.16)
        p1 = (math.cos(a + 0.55) * R * 0.30, math.sin(a + 0.55) * R * 0.30)
        p2 = (math.cos(a + 0.95) * R * 0.46, math.sin(a + 0.95) * R * 0.46)
        rays.moveTo(*p0)
        rays.quadTo(p1[0], p1[1], p2[0], p2[1])
    c.drawCircle(0, 0, R * 0.16, paint_fill(col, alpha * 0.9))
    glow_path(c, rays, col, alpha, 2.2, 1.0, 8)
    c.restore()
    # four birds flying around (opposite direction)
    c.save()
    c.rotate(math.degrees(-rot))
    for i in range(4):
        c.save()
        c.rotate(90 * i)
        b = skia.Path()
        r1, r2 = R * 0.50, R * 0.92
        b.moveTo(math.cos(0.15) * r1, math.sin(0.15) * r1)
        b.quadTo(math.cos(0.55) * (r1 + r2) / 2, math.sin(0.55) * (r1 + r2) / 2, math.cos(1.05) * r2, math.sin(1.05) * r2)
        b.quadTo(math.cos(0.9) * r2 * 0.92, math.sin(0.9) * r2 * 0.92, math.cos(0.65) * r2 * 0.95, math.sin(0.65) * r2 * 0.95)
        b.quadTo(math.cos(0.45) * r1 * 1.25, math.sin(0.45) * r1 * 1.25, math.cos(0.0) * r1 * 1.12, math.sin(0.0) * r1 * 1.12)
        b.close()
        c.drawPath(b, paint_fill(col, alpha * 0.85))
        glow_path(c, b, col, alpha * 0.6, 1.0, 0.8, 6)
        c.restore()
    c.restore()
    c.restore()


# ===================================================================== brand (燋) for burning the hollows
def draw_brand(c, tx, ty, alpha, t, ang=-2.35, length=520, heat=1.0):
    """A burning stick whose glowing tip is at (tx, ty)."""
    if alpha <= 0.003:
        return
    ex = tx - math.cos(ang) * length
    ey = ty - math.sin(ang) * length
    c.drawLine(ex, ey, tx, ty, paint_stroke((0.16, 0.09, 0.05), alpha, 11))
    c.drawLine(ex, ey, tx, ty, paint_stroke((0.45, 0.28, 0.14), alpha * 0.5, 2))
    # charred, glowing last stretch
    gx = tx - math.cos(ang) * 46
    gy = ty - math.sin(ang) * 46
    c.drawLine(gx, gy, tx, ty, paint_stroke(PAL['ember'], alpha * (0.6 + 0.4 * heat), 9))
    fl = 0.8 + 0.2 * math.sin(t * 23) * math.sin(t * 7)
    radial_glow(c, tx, ty, 90 * fl, PAL['ember'], alpha * 0.8 * heat)
    radial_glow(c, tx, ty, 20, PAL['pale'], alpha * heat)
    # thin smoke from the tip
    pts = []
    for j in range(24):
        u = j / 23
        pts.append((tx + math.sin(u * 6 + t * 1.2) * 14 * u, ty - 10 - u * 240))
    glow_path(c, smooth_path(pts), PAL['moon'], alpha * 0.18, 1.2, 1.0, 6)


# ===================================================================== willow (清明插柳)
def draw_willow(c, x0, y0, alpha, t, n=11, col=PAL['jade']):
    if alpha <= 0.003:
        return
    branch = skia.Path()
    branch.moveTo(x0, y0)
    branch.cubicTo(x0 + 200, y0 + 40, x0 + 420, y0 + 30, x0 + 640, y0 + 110)
    c.drawPath(branch, paint_stroke((0.20, 0.17, 0.12), alpha, 5))
    for i in range(n):
        u = (i + 0.5) / n
        bx = x0 + 640 * u
        by = y0 + 40 * u + 70 * u * u
        L = 260 + 220 * hash1(i, 211)
        pts = []
        for j in range(18):
            v = j / 17
            sw = math.sin(t * 0.8 + i * 0.7 + v * 2.0) * 26 * v * v
            pts.append((bx + sw + v * 18, by + v * L))
        c.drawPath(smooth_path(pts), paint_stroke(col, alpha * 0.55, 1.2))
        for j in range(2, 18, 2):
            px, py = pts[j]
            a = 0.6 + 0.4 * math.sin(i + j)
            leaf = skia.Rect.MakeXYWH(px - 3, py - 9, 6, 18)
            c.save()
            c.rotate(25 * (1 if j % 4 else -1), px, py)
            c.drawOval(leaf, paint_fill(col, alpha * 0.7 * a))
            c.restore()
