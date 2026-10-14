"""Scene composition: nine movements locked to the song's bar grid.

bar(b) = 0.122 + 2b s.  Sections (bars): intro 0-7, build 8-15, drop1 16-31,
verse 32-48, drop2 49-64, groove 65-82, drop3 83-98, breakdown 99-108,
final drop 109-115, outro 116-126.
"""
import math
import functools
import numpy as np
import cv2
import skia
from .core import (W, H, bar, beat, BEAT, C, PAL, clamp, lin, smooth, smoother, ease_out, ease_in,
                   ease_io, window, mix, mixc, hash1, paint_stroke, paint_fill, glow_path, radial_glow,
                   poly_path, smooth_path, Noise, font, adv, draw_text)
from . import elements as E

B = bar
NOISE_FOG = Noise(seed=5, base=(5, 9), octaves=5)
NOISE_SMOKE = Noise(seed=17, base=(6, 6), octaves=5)
NOISE_WARP = Noise(seed=23, base=(4, 4), octaves=3)


# ===================================================================== background
BG_KEYS = [
    # time, top, bottom
    (0.0, (0.010, 0.012, 0.022), (0.016, 0.016, 0.024)),
    (B(8), (0.012, 0.014, 0.026), (0.030, 0.022, 0.020)),
    (B(15), (0.006, 0.006, 0.012), (0.012, 0.010, 0.012)),
    (B(16), (0.020, 0.032, 0.080), (0.040, 0.030, 0.045)),
    (B(31), (0.016, 0.028, 0.070), (0.030, 0.024, 0.040)),
    (B(32), (0.008, 0.014, 0.034), (0.020, 0.020, 0.030)),
    (B(44), (0.010, 0.010, 0.020), (0.070, 0.026, 0.012)),
    (B(48.5), (0.020, 0.010, 0.010), (0.140, 0.050, 0.018)),
    (B(49), (0.016, 0.040, 0.100), (0.010, 0.016, 0.040)),
    (B(64), (0.014, 0.030, 0.080), (0.020, 0.020, 0.036)),
    (B(65), (0.030, 0.016, 0.014), (0.060, 0.026, 0.014)),
    (B(73), (0.034, 0.014, 0.012), (0.050, 0.020, 0.012)),
    (B(82), (0.012, 0.006, 0.006), (0.020, 0.008, 0.006)),
    (B(83), (0.050, 0.022, 0.014), (0.030, 0.014, 0.012)),
    (B(87), (0.030, 0.040, 0.052), (0.014, 0.018, 0.024)),
    (B(91), (0.060, 0.018, 0.012), (0.030, 0.010, 0.008)),
    (B(95), (0.008, 0.016, 0.040), (0.004, 0.012, 0.030)),
    (B(99), (0.010, 0.012, 0.034), (0.018, 0.016, 0.034)),
    (B(108), (0.012, 0.016, 0.040), (0.020, 0.018, 0.034)),
    (B(109), (0.030, 0.034, 0.080), (0.040, 0.030, 0.030)),
    (B(115), (0.030, 0.030, 0.060), (0.030, 0.024, 0.030)),
    (B(116), (0.008, 0.009, 0.016), (0.014, 0.012, 0.016)),
    (B(121), (0.020, 0.020, 0.040), (0.050, 0.034, 0.030)),
    (253.97, (0.0, 0.0, 0.0), (0.0, 0.0, 0.0)),
]


def bg_colors(t):
    for i in range(len(BG_KEYS) - 1):
        t0, a0, b0 = BG_KEYS[i]
        t1, a1, b1 = BG_KEYS[i + 1]
        if t0 <= t < t1:
            # hard cuts on drop downbeats, smooth elsewhere
            dur = min(t1 - t0, 1.2)
            x = smooth(lin(t, t1 - dur, t1)) if (t1 - t0) > 1.2 else smooth(lin(t, t0, t1))
            return mixc(a0, a1, x), mixc(b0, b1, x)
    return BG_KEYS[-1][1], BG_KEYS[-1][2]


_grad_y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]


FOG_KEYS = [
    (0.0, (0.25, 0.27, 0.35), 0.7),
    (B(8), (0.40, 0.30, 0.20), 0.9),
    (B(16), (0.20, 0.30, 0.62), 1.5),
    (B(32), (0.16, 0.20, 0.36), 1.0),
    (B(40), (0.50, 0.24, 0.10), 1.2),
    (B(49), (0.18, 0.32, 0.66), 1.5),
    (B(65), (0.50, 0.26, 0.12), 1.3),
    (B(83), (0.55, 0.32, 0.15), 1.3),
    (B(87), (0.32, 0.40, 0.48), 2.0),
    (B(91), (0.60, 0.20, 0.10), 1.2),
    (B(95), (0.16, 0.26, 0.55), 1.5),
    (B(99), (0.26, 0.22, 0.48), 1.3),
    (B(109), (0.40, 0.33, 0.55), 1.6),
    (B(116), (0.32, 0.26, 0.26), 1.0),
    (254.0, (0.32, 0.26, 0.26), 0.6),
]


def fog_params(t):
    for i in range(len(FOG_KEYS) - 1):
        t0, c0, a0 = FOG_KEYS[i]
        t1, c1, a1 = FOG_KEYS[i + 1]
        if t0 <= t < t1:
            x = smooth(lin(t, t1 - min(1.2, t1 - t0), t1))
            return mixc(c0, c1, x), mix(a0, a1, x)
    return FOG_KEYS[-1][1], FOG_KEYS[-1][2]


def paint_background(arr, t, fog_amt=1.0, fog_col=None):
    fc, fa = fog_params(t)
    fog_col = fog_col or fc
    fog_amt = fog_amt * fa
    top, bot = bg_colors(t)
    top = np.array(top, np.float32)
    bot = np.array(bot, np.float32)
    g = top + (bot - top) * (_grad_y ** 1.2)
    arr[..., :3] = g
    arr[..., 3] = 1.0
    if fog_amt > 0.003:
        f = NOISE_FOG.field(320, 180, t, speed=0.05, drift=(0.008, -0.004), octaves=5)
        f = np.clip((f - 0.36) * 2.0, 0, 1) ** 1.5
        f = cv2.resize(f, (W, H), interpolation=cv2.INTER_CUBIC)
        arr[..., :3] += f[..., None] * (np.array(fog_col, np.float32) * 0.20 * fog_amt)


# ===================================================================== particles
def dust(c, t, alpha, col=PAL['moon'], n=140, seed=1, spin=None, hat=0.0, size=1.0, rise=0.0):
    """Floating motes. spin=(cx, cy, strength) pulls them into an orbit."""
    if alpha <= 0.003:
        return
    for i in range(n):
        x0 = hash1(i, seed) * W
        y0 = hash1(i, seed + 1) * H
        z = 0.3 + 0.7 * hash1(i, seed + 2)
        vx = (hash1(i, seed + 3) - 0.5) * 12 * z
        vy = (hash1(i, seed + 4) - 0.5) * 8 * z - rise * 40 * z
        x = (x0 + vx * t + math.sin(t * 0.3 + i) * 20 * z) % W
        y = (y0 + vy * t + math.cos(t * 0.27 + i * 1.3) * 16 * z) % H
        if spin is not None:
            cx, cy, s = spin
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy) + 1e-3
            ang = math.atan2(dy, dx) + s * (0.6 + 0.4 * z) * 1.6 / (0.4 + r / 600)
            r2 = r * (1 - 0.45 * s * z)
            x, y = cx + math.cos(ang) * r2, cy + math.sin(ang) * r2
        tw = 0.55 + 0.45 * math.sin(t * (0.8 + 2 * hash1(i, seed + 5)) + i)
        a = alpha * z * tw * (0.35 + 0.65 * hash1(i, seed + 6)) * (1 + hat * 0.8 * hash1(i, 9))
        rr = (1.0 + 2.2 * z) * size
        c.drawCircle(x, y, rr, paint_fill(col, min(1.0, a), blur=rr * 0.6))


@functools.lru_cache(maxsize=4)
def star_table(n=600, seed=4):
    rng = np.random.default_rng(seed)
    xs = rng.random(n) * W
    ys = (rng.random(n) ** 1.6) * H * 0.95
    mag = rng.random(n) ** 3
    ph = rng.random(n) * 6.28
    return xs, ys, mag, ph


def stars(c, t, alpha, ymax=H, col=(0.85, 0.88, 1.0), dy=0.0):
    if alpha <= 0.003:
        return
    xs, ys, mag, ph = star_table()
    groups = {}
    for x, y, m, p in zip(xs, ys, mag, ph):
        yy = y + dy
        if yy > ymax or yy < -5:
            continue
        tw = 0.65 + 0.35 * math.sin(t * (1 + m * 2) + p)
        a = alpha * (0.25 + 0.75 * m) * tw
        size = 1.2 + 2.2 * m
        key = (round(a, 2), round(size, 1))
        groups.setdefault(key, []).append(skia.Point(x, yy))
    for (a, size), pts in groups.items():
        p = paint_stroke(col, a, size)
        c.drawPoints(skia.Canvas.kPoints_PointMode, pts, p)


def sparks(c, t, t_emit, x, y, n=40, alpha=1.0, speed=380, life=1.4, col=PAL['ember'], seed=0, up=0.6, spread=1.0):
    """Burst of sparks emitted at t_emit (stateless ballistic)."""
    age = t - t_emit
    if age < 0 or age > life or alpha <= 0.003:
        return
    for i in range(n):
        a = -math.pi / 2 + (hash1(i, seed) - 0.5) * 2 * math.pi * 0.5 * spread
        sp = speed * (0.3 + 0.7 * hash1(i, seed + 1))
        lf = life * (0.4 + 0.6 * hash1(i, seed + 2))
        if age > lf:
            continue
        vx, vy = math.cos(a) * sp, math.sin(a) * sp * up
        px = x + vx * age
        py = y + vy * age + 160 * age * age
        k = 1 - age / lf
        rr = 1.2 + 1.8 * hash1(i, seed + 3)
        c.drawLine(px, py, px - vx * 0.02, py - vy * 0.02, paint_stroke(mixc(col, PAL['pale'], k * 0.5), alpha * k, rr))


def falling_lights(c, t, alpha, x, y_top, y_bot, n=60, spread=420, col=PAL['pale'], seed=3, speed=0.35):
    """Lights descending into a centre point (天神皆降)."""
    if alpha <= 0.003:
        return
    for i in range(n):
        ph = (hash1(i, seed) + t * speed * (0.6 + 0.8 * hash1(i, seed + 1))) % 1.0
        e = ease_in(ph, 1.6)
        sx = x + (hash1(i, seed + 2) - 0.5) * 2 * spread * (1 - e)
        sy = mix(y_top, y_bot, e)
        a = alpha * math.sin(math.pi * ph) * (0.4 + 0.6 * hash1(i, seed + 3))
        c.drawLine(sx, sy - 18 - 30 * e, sx, sy, paint_stroke(col, a * 0.6, 2.0, blur=2))
        radial_glow(c, sx, sy, 6 + 6 * hash1(i, 7), col, a)


# ===================================================================== smoke (puffs)
SW, SH = 480, 270
_pbuf = np.zeros((SH, SW, 4), np.float32)
_psurf = None
NOISE_TEX = Noise(seed=31, base=(6, 10), octaves=4)


def smoke_puffs(t, sx, sy, height, rate=14, life=7.0, r0=6, r1=70, spread=60, seed=0, wind=0.0, strength=0.22):
    """Rising smoke as soft billows (stateless). Coordinates in 1/4-res pixels.
    Returns a density map (SH, SW)."""
    global _psurf
    if _psurf is None:
        _psurf = skia.Surface(_pbuf, colorType=skia.kRGBA_F32_ColorType, alphaType=skia.kPremul_AlphaType)
    _pbuf[...] = 0
    c = _psurf.getCanvas()
    n = int(life * rate)
    i0 = int(math.floor(t * rate))
    for k in range(i0 - n, i0 + 1):
        tb = k / rate
        age = t - tb
        if age < 0 or age > life:
            continue
        u = age / life
        h1, h2, h3 = hash1(k, seed), hash1(k, seed + 1), hash1(k, seed + 2)
        y = sy - height * (1 - (1 - u) ** 1.6)
        x = (sx + (h1 - 0.5) * spread * u + math.sin(age * 0.9 + h2 * 6.28) * spread * 0.35 * u
             + math.sin(t * 0.3 + k * 0.1) * spread * 0.3 * u + wind * u * u * 80)
        r = r0 + (r1 - r0) * u ** 0.8 * (0.7 + 0.6 * h3)
        a = (1 - u) ** 1.4 * min(1, age * 2) * strength
        p = skia.Paint(AntiAlias=True)
        p.setShader(skia.GradientShader.MakeRadial(
            skia.Point(x, y), r, [C(1, 1, 1, a), C(1, 1, 1, a * 0.5), C(1, 1, 1, 0)], [0, 0.45, 1]))
        c.drawCircle(x, y, r, p)
    d = _pbuf[..., 3].copy()
    tex = NOISE_TEX.field(SW, SH, t, speed=0.15, drift=(0.0, 0.05))
    return d * (0.35 + 1.3 * tex)


def add_density(arr, d, col_bottom, col_top, amt):
    if amt <= 0.003:
        return
    up = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
    g = _grad_y
    colmap = np.array(col_top, np.float32) * (1 - g) + np.array(col_bottom, np.float32) * g
    arr[..., :3] += np.clip(up, 0, 2)[..., None] * colmap * amt


def smoke_density(t, sx, sy, height, w0=0.012, spread=0.10, turb=1.0, rise_speed=0.18, res=(384, 216), seed_t=0.0):
    """Density field of a rising smoke column. sx,sy in [0,1] (source), height in screen fraction."""
    w, h = res
    u = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    v = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    dy = np.clip((sy - v) / max(1e-3, height), 0, None)          # 0 at source, 1 at top
    warp = NOISE_WARP.field(w, h, t + seed_t, speed=0.12, drift=(0.0, rise_speed * 0.5), scale=0.7)
    sway = (warp - 0.5) * 0.18 * turb * dy ** 0.8 + 0.03 * np.sin(t * 0.4 + dy * 3.0) * dy
    width = w0 + spread * dy ** 1.1
    dx = (u - sx - sway) / width
    col = np.exp(-dx * dx) * np.clip(dy * 12, 0, 1) * np.clip(1.25 - dy, 0, 1)
    detail = NOISE_SMOKE.field(w, h, t + seed_t, speed=0.10, drift=(0.0, rise_speed), scale=0.8)
    d = col * np.clip((detail - 0.30) * 1.8, 0, 1.2)
    d[v[:, 0] > sy + 0.004, :] = 0
    return d


def add_smoke(arr, dens, col, amt):
    if amt <= 0.003:
        return
    d = cv2.resize(dens, (W, H), interpolation=cv2.INTER_CUBIC)
    d = cv2.GaussianBlur(d, (0, 0), 2.0)
    arr[..., :3] += np.clip(d, 0, 2)[..., None] * (np.array(col, np.float32) * amt)


# ===================================================================== camera helpers
def kick_bump(A, t, amt=0.012, decay=0.14):
    return 1 + amt * A.kick(t, decay)


class Cam:
    def __init__(self, c, cx=W / 2, cy=H / 2, s=1.0, rot=0.0, dx=0.0, dy=0.0):
        self.c = c
        c.save()
        c.translate(cx + dx, cy + dy)
        c.scale(s, s)
        if rot:
            c.rotate(math.degrees(rot))
        c.translate(-cx, -cy)

    def close(self):
        self.c.restore()


def layer(c, alpha):
    """Begin an alpha layer (returns True if should draw)."""
    if alpha <= 0.003:
        return False
    if alpha < 0.997:
        c.saveLayerAlpha(None, int(alpha * 255))
    else:
        c.save()
    return True


# ===================================================================== movement 0-1 · 寻常 / 显
ROW_X = [W / 2 + (i - 1.5) * 300 for i in range(4)]


def act_stone(c, arr, t, A):
    vis = window(t, 0.4, B(16) + 0.7, 2.6, 0.6)
    if vis <= 0:
        return
    # stone placement: centre -> row slot 0 (bars 4-7) -> centre (bar 7..8)
    to_row = smooth(lin(t, B(4) - 0.6, B(4) + 0.6))
    back = smooth(lin(t, B(7), B(8) - 0.1))
    k = to_row * (1 - back)
    sx = mix(W / 2, ROW_X[0], k)
    sy = mix(600, 590, k)
    R = mix(118, 86, k)
    appear = ease_out(lin(t, 0.6, 5.5), 2)
    ign = lin(t, B(8), B(8) + 0.25)                 # sub-bass entry ignites
    glow = 0.0
    lines = 0.0
    if t >= B(8):
        breathe = 0.5 + 0.5 * math.sin((t - B(8)) * math.pi / 2)
        build = lin(t, B(8), B(15))
        glow = ign * (0.35 + 0.35 * breathe * 0.4 + 0.9 * build ** 1.6) + 0.6 * A.kick(t, 0.25)
        lines = ign * (0.4 + 0.6 * build)
        # pre-drop inhale (bar 15)
        inhale = lin(t, B(15), B(16))
        glow *= (1 - 0.75 * smooth(inhale))
        lines *= (1 - smooth(inhale))
    if t >= B(16):
        glow = 0
    a = vis * appear
    # orbit rings (bars 9..14), one per bar
    if t >= B(8):
        ring_a = a * (1 - smooth(lin(t, B(15), B(15) + 1.2)))
        for r_i in range(6):
            tb = B(9 + r_i)
            u = ease_out(lin(t, tb - 0.15, tb + 0.9))
            if u <= 0:
                continue
            rr = R * (1.9 + r_i * 0.62)
            rot = (t - tb) * (0.12 if r_i % 2 else -0.09)
            arc = skia.Path()
            segs = 9 if r_i % 2 == 0 else 12
            for s_ in range(segs):
                a0 = math.degrees(rot) + s_ * 360 / segs
                arc.addArc(skia.Rect.MakeXYWH(sx - rr, sy - rr * 0.9, 2 * rr, 1.8 * rr), a0, 360 / segs * 0.62 * u)
            glow_path(c, arc, PAL['gold'], ring_a * 0.55 * u, 1.0, 0.8, 6)
        # god rays building in bars 12-15
        rays = lin(t, B(12), B(15)) * (1 - smooth(lin(t, B(15), B(15) + 0.5)))
        if rays > 0.003:
            for i in range(36):
                ang = 2 * math.pi * i / 36 + t * 0.05
                L = R * (2.5 + 3.5 * hash1(i, 4)) * (0.6 + 0.4 * rays)
                pth = poly_path([(sx + math.cos(ang) * R * 1.2, sy + math.sin(ang) * R * 0.9),
                                 (sx + math.cos(ang) * L, sy + math.sin(ang) * L * 0.9)])
                c.drawPath(pth, paint_stroke(PAL['gold'], a * rays * 0.18 * (0.5 + 0.5 * math.sin(t * 3 + i)), 2.0, blur=3))
    E.draw_stone(c, sx, sy, R, glow=glow, alpha=a, lines=lines, t=t)
    # the other three: wood / fire / bowl appear on bars 4,5,6
    for i, tb in enumerate((B(4), B(5), B(6))):
        ai = vis * ease_out(lin(t, tb - 0.05, tb + 0.9)) * (1 - smooth(lin(t, B(7), B(7) + 1.2)))
        if ai <= 0.003:
            continue
        x = ROW_X[i + 1]
        y = 590 + (1 - ease_out(lin(t, tb, tb + 1.2))) * 16
        if i == 0:
            E.draw_log(c, x, y, 70, ai * 0.85)
        elif i == 1:
            E.draw_flame_line(c, x, y + 40, 58, ai * 0.85, t)
        else:
            E.draw_bowl(c, x, y + 10, 64, ai * 0.85, t, steam=0.8)
        # tiny labels
        lab = '石木火饭'[i + 1]
        draw_text(c, lab, x, 720, size=22, face='serif_l', col=PAL['moon'], alpha=ai * 0.45, reveal=1)
    la = vis * ease_out(lin(t, B(4) - 0.2, B(4) + 0.9)) * (1 - smooth(lin(t, B(7), B(7) + 1.2)))
    draw_text(c, '石', ROW_X[0], 720, size=22, face='serif_l', col=PAL['moon'], alpha=la * 0.45, reveal=1)
    # build: dust spiralling into the stone
    if t >= B(8):
        s = clamp(lin(t, B(8), B(15))) * (1 - smooth(lin(t, B(15), B(15) + 0.4)))
        dust(c, t, vis * 0.9 * (0.4 + 0.6 * s), col=PAL['gold'], n=120, seed=21,
             spin=(sx, sy, 0.25 + 0.6 * s), hat=A.hat_env(t))
    # bar 15: the single point + faint 显
    inh = lin(t, B(15) - 0.2, B(16))
    if 0 < inh < 1 and t < B(16):
        pa = smooth(lin(t, B(15) - 0.2, B(15) + 0.6))
        radial_glow(c, sx, sy - 10, 40 + 120 * inh ** 3, PAL['pale'], pa * (0.6 + inh))
        f = font('serif_l', 360)
        wch = adv('serif_l', 360, '显')
        c.drawString('显', W / 2 - wch / 2, H / 2 + 120, f, paint_fill(PAL['gold'], 0.10 * pa * (1 - 0.3 * inh), blur=2 + 10 * (1 - inh)))


# ===================================================================== movement 2 · 圣显 / 天地
def act_cosmos(c, arr, t, A):
    vis = window(t, B(16), B(32) + 0.8, 0.02, 0.8)
    if vis <= 0:
        return
    kick = A.kick(t, 0.18)
    flash = math.exp(-(t - B(16)) / 0.45) if t >= B(16) else 0
    stars(c, t, vis * smooth(lin(t, B(16), B(18))) * 0.8)
    # --- mandala & title (bars 16-24)
    man_a = vis * (1 - smooth(lin(t, B(23), B(24) + 0.6)))
    if man_a > 0.003:
        grow = ease_out(lin(t, B(16), B(16) + 1.6), 4)
        R = 330 * (0.55 + 0.45 * grow) * (1 + 0.025 * kick)
        E.draw_mandala(c, W / 2, H / 2 - 20, R, man_a * (0.85 + 0.35 * kick), t, rot=t * 0.05, pulse=kick)
        E.draw_mandala(c, W / 2, H / 2 - 20, R * 1.55, man_a * 0.28, t, rot=-t * 0.03, fold=12)
        radial_glow(c, W / 2, H / 2 - 20, R * 1.3, PAL['gold'], man_a * (0.10 + 0.10 * kick))
        # kick shockwaves
        for kt in A.kicks:
            if B(16) <= kt <= t and t - kt < 1.2:
                age = (t - kt) / 1.2
                c.drawCircle(W / 2, H / 2 - 20, R * (1.0 + 1.3 * ease_out(age)),
                             paint_stroke(PAL['pale'], man_a * 0.35 * (1 - age) ** 2, 2.0, blur=2))
        # the stone sits in the heart of the mandala (bars 20-24)
        st = smooth(lin(t, B(20) - 0.4, B(20) + 1.2)) * man_a
        E.draw_stone(c, W / 2, H / 2 - 20, 70, glow=0.5 + 0.6 * kick, alpha=st, lines=1.0, t=t)
        radial_glow(c, W / 2, H / 2 - 20, 200 + 500 * flash, PAL['pale'], flash * 1.5 * vis)
    # --- heaven / earth / tree (bars 24-32)
    cos_a = vis * smooth(lin(t, B(23) + 0.6, B(24) + 0.4))
    if cos_a > 0.003:
        ground_y = 790
        # kicks since bar 24 drive tree growth; since bar 28 drive heaven's rise
        kt = A.kicks
        def count(t0, t1):
            m = (kt >= t0) & (kt <= min(t, t1))
            n = int(m.sum())
            last = kt[m][-1] if n else t0
            return n - 1 + ease_out(clamp((t - last) / 0.35)) if n else 0.0
        g = clamp(count(B(24) - 0.01, B(28) - 0.1) / 15.0)
        sep = count(B(28) - 0.01, B(32)) / 16.0
        sep = clamp(sep)
        hx, hy = W / 2, mix(150, -40, ease_out(sep, 2))
        hr = mix(120, 60, sep)
        E.draw_heaven(c, hx, hy, hr, cos_a * (1 - 0.3 * sep), t, rot=t * 0.04)
        c.save()
        c.translate(W / 2, ground_y + 30)
        c.scale(1, 0.35)
        E.draw_earth(c, 0, 0, 520, cos_a * 0.9)
        c.restore()
        # tree: top segment dissolves as heaven departs
        tree_h = 520
        c.save()
        if sep > 0:
            cut = ground_y - tree_h * (1.0 - 0.45 * sep)
            c.clipRect(skia.Rect.MakeLTRB(0, cut, W, H))
        E.draw_tree(c, W / 2, ground_y, tree_h, g, cos_a, t, flow=(1 - sep) * smooth(lin(t, B(25), B(26))) * cos_a)
        c.restore()
        # tie between tree-top and heaven (breaks on bar 28)
        tie = cos_a * smooth(lin(t, B(26), B(27))) * (1 - smooth(lin(t, B(28), B(28) + 0.5)))
        if tie > 0.003:
            c.drawLine(W / 2, ground_y - tree_h, hx, hy + hr, paint_stroke(PAL['pale'], tie * 0.7, 1.4, blur=1))
        if sep > 0:
            # rift + fragments drifting upward
            rift = math.exp(-(t - B(28)) / 0.9) if t >= B(28) else 0
            c.drawLine(0, ground_y - tree_h * 0.75, W, ground_y - tree_h * 0.75,
                       paint_stroke(PAL['pale'], cos_a * rift * 0.8, 2.0, blur=3))
            for i in range(50):
                ph = hash1(i, 41)
                age = t - B(28) - ph * 1.2
                if age < 0:
                    continue
                fx = W / 2 + (hash1(i, 42) - 0.5) * 260
                fy = ground_y - tree_h * (0.6 + 0.4 * hash1(i, 43)) - age * (60 + 90 * hash1(i, 44))
                fa = cos_a * math.exp(-age / 2.5) * 0.8
                radial_glow(c, fx, fy, 5 + 4 * hash1(i, 45), PAL['pale'], fa)
        dust(c, t, cos_a * 0.4, col=PAL['pale'], n=80, seed=31)


# ===================================================================== movement 3 · 卜
CRACK_SCHED = None


def crack_schedule(A):
    """Main crack on bar 40; more cracks on snare hits from bar 44 to 49."""
    global CRACK_SCHED
    if CRACK_SCHED is None:
        ev = [(B(40), 7, 1)]
        sn = A.snare_on
        dt = A.dt
        last = -1
        hol = len(E.plastron_hollows())
        k = 0
        for i in range(int(B(44) / dt), int(B(49) / dt)):
            tt = i * dt
            thr = 0.55 if tt < B(46) else 0.42
            if sn[i] > thr and tt - last > (0.24 if tt < B(46) else 0.12):
                k += 1
                ev.append((tt, (7 + k * 5) % hol, 1 if k % 2 else -1))
                last = tt
        CRACK_SCHED = ev
    return CRACK_SCHED


def act_bone(c, arr, t, A):
    vis = window(t, B(32), B(49) + 0.25, 0.05, 0.25)
    if vis <= 0:
        return
    # 天远了: heaven far away, a lamp on the ground (bars 32-36)
    far = vis * (1 - smooth(lin(t, B(36) - 0.3, B(36) + 0.8)))
    stars(c, t, vis * 0.55 * (1 - smooth(lin(t, B(44), B(48)))))
    if far > 0.003:
        hy = 120 + 6 * math.sin(t * 0.3)
        E.draw_heaven(c, W / 2, hy, 60, far * 0.55, t, rot=t * 0.02)
        c.drawLine(0, 820, W, 820, paint_stroke(PAL['moon'], far * 0.25, 1.0))
        radial_glow(c, W / 2, 815, 60, PAL['ember'], far * 0.7)
        radial_glow(c, W / 2, 815, 10, PAL['pale'], far)
        # broken dotted line between man and heaven
        for i in range(40):
            yy = 800 - i * 16
            if yy < hy + 70:
                break
            gap = 330 < yy < 560
            a = far * (0.08 if gap else 0.35) * (0.6 + 0.4 * math.sin(t * 2 - i * 0.4))
            c.drawCircle(W / 2, yy, 1.8, paint_fill(PAL['moon'], a))
        dust(c, t, far * 0.5, col=PAL['moon'], n=90, seed=51, rise=-0.6)
    # the plastron (bar 36 onward)
    pa = vis * ease_out(lin(t, B(36) - 0.05, B(36) + 1.6), 2)
    if pa > 0.003:
        heat = 0.15 * lin(t, B(36), B(40)) + 0.25 * lin(t, B(40), B(46)) + 0.6 * ease_in(lin(t, B(46), B(49)), 2)
        cracks = []
        for (te, hi, side) in crack_schedule(A):
            if t >= te - 0.02:
                prog = ease_out(lin(t, te - 0.02, te + (0.35 if te > B(41) else 0.6)), 2)
                fl = math.exp(-(t - te) / (0.5 if te > B(41) else 0.9))
                cracks.append((hi, prog, fl, side))
        shake = 0
        if t >= B(40):
            shake = math.exp(-(t - B(40)) / 0.15) * 6
        sx = W / 2 - 170 + shake * math.sin(t * 90)
        sy = 440
        ps = 330
        radial_glow(c, sx, sy, 700, PAL['ember'], pa * (0.10 + 0.35 * heat))
        E.draw_plastron(c, sx, sy, ps, pa, heat=heat * 0.7, t=t, cracks=cracks)
        # the brand: approaches the first hollow during bars 37-40, touches on bar 40's kick
        hx, hy = E.plastron_hollows()[7]
        tx, ty = sx + hx * ps, sy + hy * ps
        appr = ease_io(lin(t, B(37), B(40)))
        away = ease_in(lin(t, B(40) + 0.25, B(41) + 0.5), 2)
        dist = 420 * (1 - appr) + 520 * away
        ang = -2.3
        bx_, by_ = tx - math.cos(ang) * dist, ty - math.sin(ang) * dist
        ba = pa * smooth(lin(t, B(36) + 0.5, B(37) + 0.5)) * (1 - smooth(lin(t, B(41), B(41) + 1.0)))
        E.draw_brand(c, bx_, by_, ba, t, ang=ang, heat=0.7 + 0.3 * appr)
        # later burnings: a glowing point at each new crack (no brand drawn)
        for (te, hi, side) in crack_schedule(A)[1:]:
            if -0.3 <= t - te < 0.5:
                hx2, hy2 = E.plastron_hollows()[hi % len(E.plastron_hollows())]
                k = 1 - abs(t - te) / 0.5
                radial_glow(c, sx + hx2 * ps, sy + hy2 * ps, 70, PAL['ember'], pa * k * 0.8)
        # 卜 glyph echoing the main crack
        ga = pa * smooth(lin(t, B(40) + 0.4, B(41) + 0.5)) * (1 - smooth(lin(t, B(44) - 0.5, B(44) + 0.5)))
        if ga > 0.003:
            f = font('serif_b', 300)
            wch = adv('serif_b', 300, '卜')
            c.drawString('卜', W / 2 + 330 - wch / 2, 560, f, paint_fill(PAL['ember'], ga * 0.25, blur=12))
            c.drawString('卜', W / 2 + 330 - wch / 2, 560, f, paint_stroke(PAL['bone'], ga * 0.85, 1.4))
        # sparks on crack events
        for (te, hi, side) in crack_schedule(A):
            if 0 <= t - te < 1.4:
                hx, hy = E.plastron_hollows()[hi % len(E.plastron_hollows())]
                sparks(c, t, te, sx + hx * ps, sy + hy * ps, n=26 if te > B(41) else 60, alpha=pa,
                       speed=300 if te > B(41) else 520, seed=int(te * 10))
        # rising embers
        dust(c, t, pa * (0.3 + 0.7 * heat), col=PAL['ember'], n=110, seed=71, rise=1.5, hat=A.hat_env(t))
        # white-out into the drop
        wo = ease_in(lin(t, B(48), B(49)), 3)
        if wo > 0:
            radial_glow(c, sx, sy, 300 + 1400 * wo, PAL['pale'], wo * 1.4 * vis)


# ===================================================================== movement 4 · 圜丘
def act_altar(c, arr, t, A):
    vis = window(t, B(49), B(65) + 0.9, 0.02, 0.9)
    if vis <= 0:
        return
    kick = A.kick(t, 0.2)
    flash = math.exp(-(t - B(49)) / 0.5) if t >= B(49) else 0
    # ring schedule: upper tier on beats (bars 49-51), middle on beats (51-53), lower (53-55)
    tb = B(49)
    n_beats = (t - tb) / BEAT
    rings = clamp(n_beats + 1, 0, 27) if t >= tb else 0
    rings_f = rings if rings < 27 else 27
    # fractional reveal per beat
    k = int(n_beats)
    fr = ease_out(clamp((n_beats - k) / 0.6))
    rings_v = min(27.0, k + fr) if t >= tb else 0
    rails = lin(t, B(55) + 0.5, B(56) + 1.0)
    stairs = lin(t, B(55) + 1.0, B(56) + 1.5)
    walls = smooth(lin(t, B(56) + 0.3, B(57) + 0.3))
    # camera: top-down, then tilt into an oblique view from bar 57 (冬至)
    tilt = smooth(lin(t, B(57), B(61)))
    sy_scale = mix(1.0, 0.42, tilt)
    R = mix(400, 520, smooth(lin(t, B(55), B(58)))) * (1 + 0.012 * kick)
    cy = mix(H / 2, H * 0.66, tilt)
    rot = t * 0.035
    stars(c, t, vis * 0.5)
    c.save()
    c.translate(W / 2, cy)
    c.scale(1, sy_scale)
    c.translate(-W / 2, -cy)
    pulse_ring = int(rings_v) if rings_v < 27 else -1
    E.draw_yuanqiu(c, W / 2, cy, R, t, rings=rings_v, rails=rails, stairs=stairs, walls=walls,
                   alpha=vis, rot=rot, center_glow=0.4 + flash * 2 + kick * 0.6,
                   pulse_ring=pulse_ring, pulse=0.6 * (1 - fr))
    # kick ripples from the centre (bars 61-64)
    rip = smooth(lin(t, B(61), B(61) + 0.5)) * (1 - smooth(lin(t, B(63), B(64))))
    if rip > 0:
        for kt in A.kicks:
            if B(61) <= kt <= t and t - kt < 1.5:
                age = (t - kt) / 1.5
                c.drawCircle(W / 2, cy, R * 1.6 * ease_out(age), paint_stroke(PAL['gold'], vis * rip * 0.7 * (1 - age) ** 2, 3.0, blur=3))
    c.restore()
    # 天神皆降: lights descending to the centre (bars 57-61), axis of light (61-65)
    fall = vis * smooth(lin(t, B(57) + 0.5, B(58) + 0.5)) * (1 - smooth(lin(t, B(61), B(62))))
    falling_lights(c, t, fall, W / 2, -40, cy, n=70, spread=520, seed=81)
    axis = vis * smooth(lin(t, B(61) - 0.5, B(62))) * (1 - smooth(lin(t, B(64) + 1.0, B(65) + 0.8)))
    if axis > 0.003:
        top = mix(cy, -50, ease_out(lin(t, B(61) - 0.5, B(62) + 0.5)))
        for wdt, aa, bl in ((60, 0.10, 30), (16, 0.35, 8), (3, 1.0, 0)):
            c.drawLine(W / 2, cy, W / 2, top, paint_stroke(PAL['pale'], axis * aa * (1 + 0.5 * kick), wdt, blur=bl))
        # half-time fill: bar 63-64 -> rings pulse inward
        fill = lin(t, B(63), B(65))
        if fill > 0:
            for i in range(4):
                ph = (t * 1.0 + i / 4) % 1
                c.drawCircle(W / 2, cy, 300 * (1 - ph) + 10, paint_stroke(PAL['gold'], axis * fill * ph * 0.6, 1.5))
    radial_glow(c, W / 2, cy, 260 + 900 * flash, PAL['pale'], flash * 1.2 * vis)
    dust(c, t, vis * 0.35, col=PAL['pale'], n=70, seed=91, hat=A.hat_env(t))


# ===================================================================== movement 5 · 烟 · 主
def act_ancestors(c, arr, t, A):
    vis = window(t, B(64) + 1.0, B(83) + 0.2, 1.2, 0.2)
    if vis <= 0:
        return
    kick = A.kick(t, 0.22)
    # --- 燔柴: wood pyre + great smoke column (bars 65-69)
    pyre = vis * (1 - smooth(lin(t, B(69) - 0.5, B(70) + 0.5)))
    if pyre > 0.003:
        px, py = W / 2, 800
        # ghost of the altar beneath
        c.save()
        c.translate(W / 2, py + 70)
        c.scale(1, 0.30)
        c.translate(-W / 2, -(py + 70))
        E.draw_yuanqiu(c, W / 2, py + 70, 620, t, rings=27, rails=1, stairs=1, walls=0, alpha=pyre * 0.30, rot=t * 0.035)
        c.restore()
        d = smoke_puffs(t, px / 4, py / 4 - 10, 240, rate=16, life=8.0, r0=10, r1=95, spread=70, seed=7, strength=0.26)
        add_density(arr, d, (0.95, 0.55, 0.30), (0.45, 0.45, 0.55), pyre * (0.85 + 0.35 * kick))
        radial_glow(c, px, py, 520, PAL['ember'], pyre * (0.45 + 0.35 * kick))
        # 柴: crossed logs stacked like 井
        for lvl in range(4):
            yy = py + 40 - lvl * 22
            w_ = 170 - lvl * 30
            if lvl % 2 == 0:
                c.drawLine(px - w_, yy, px + w_, yy, paint_stroke((0.20, 0.10, 0.05), pyre, 14))
                c.drawLine(px - w_, yy, px + w_, yy, paint_stroke(PAL['ember'], pyre * 0.35, 2))
            else:
                for sx_ in (-1, 1):
                    c.drawLine(px + sx_ * w_ * 0.6, yy + 12, px + sx_ * w_ * 0.45, yy - 12, paint_stroke((0.20, 0.10, 0.05), pyre, 12))
        # flames: an organic cluster, tallest in the middle
        for i in range(9):
            fx = px + (hash1(i, 3) - 0.5) * 220 * (1 - 0.4 * abs(i - 4) / 4)
            fh = 70 + 90 * (1 - abs(i - 4) / 4) * (0.7 + 0.3 * hash1(i, 4)) + 30 * kick
            E.draw_flame(c, fx, py + 10 - 10 * hash1(i, 5), fh, pyre * 0.9, t * (0.9 + 0.2 * hash1(i, 6)), seed=i * 1.7)
        dust(c, t, pyre * 0.9, col=PAL['ember'], n=100, seed=101, rise=2.0, hat=A.hat_env(t))
    # --- the hall of tablets (bars 69-73) and the single tablet (73-83)
    hall = vis * smooth(lin(t, B(69) - 0.3, B(70) + 0.4))
    if hall > 0.003:
        zoom = ease_io(lin(t, B(72) + 0.5, B(73) + 0.4))
        cs = mix(1.0, 2.35, zoom)
        cxf, cyf = W / 2, mix(560, 470, zoom)
        cam = Cam(c, W / 2, 560, cs, dy=(cyf - 560) * 0)
        # incense smoke (three sticks) in front of the hall
        for i in range(7):
            x = W / 2 + (i - 3) * 190
            h = 340 if i != 3 else 380
            a = hall * (1 - 0.7 * zoom if i != 3 else 1.0)
            glowc = 0.25 + (0.7 if i == 3 else 0.0) * smooth(lin(t, B(75), B(75) + 0.3))
            if i == 3:
                glowc += 0.5 * math.exp(-(t - B(75)) / 0.8) if t >= B(75) else 0
                glowc += 0.25 * kick
            E.draw_tablet(c, x, 520, 110 if i == 3 else 90, h, a * (0.75 if i != 3 else 1.0), glow=glowc * a,
                          text=None, faint_lines=(i != 3))
        # candles
        for sx_ in (-1, 1):
            E.draw_candle(c, W / 2 + sx_ * 105, 690, 28, hall, t, seed=sx_)
        cam.close()
        # 神王 / 神主 on the central tablet, drawn in screen space after zoom
        ta = hall * smooth(lin(t, B(73) - 0.2, B(73) + 0.8))
        if ta > 0.003:
            ts = 82
            f = font('serif_sb', ts)
            x0 = W / 2
            ys = [cyf - 120 + 0, cyf - 120 + ts * 1.25]
            for j, ch in enumerate('神王'):
                cw = adv('serif_sb', ts, ch)
                c.drawString(ch, x0 - cw / 2, ys[j] + ts * 0.8, f, paint_fill(PAL['gold'], ta * 0.35, blur=10))
                c.drawString(ch, x0 - cw / 2, ys[j] + ts * 0.8, f, paint_fill(PAL['gold'], ta))
            # the cinnabar dot: brush lands on bar 75's downbeat
            d = lin(t, B(75) - 0.04, B(75) + 0.08)
            if d > 0:
                dx, dy = x0 + 2, ys[1] + ts * 0.8 - ts * 0.84
                rr = ts * 0.12 * ease_out(d)
                drop = skia.Path()
                drop.moveTo(dx - rr * 0.9, dy - rr * 0.7)
                drop.cubicTo(dx + rr * 0.3, dy - rr * 1.4, dx + rr * 1.6, dy + rr * 0.2, dx + rr * 0.3, dy + rr * 1.0)
                drop.cubicTo(dx - rr * 0.4, dy + rr * 1.2, dx - rr * 1.3, dy - rr * 0.1, dx - rr * 0.9, dy - rr * 0.7)
                c.drawPath(drop, paint_fill(PAL['cinnabar'], ta))
                fl = math.exp(-(t - B(75)) / 0.6) if t >= B(75) else 0
                radial_glow(c, dx, dy, 60 + 260 * fl, PAL['cinnabar'], ta * (0.25 + fl))
                radial_glow(c, dx, dy, 30, PAL['pale'], ta * fl)
                # ripple of the arrival
                if t >= B(75):
                    age = (t - B(75)) / 2.2
                    if age < 1:
                        c.drawCircle(x0, cyf, 80 + 700 * ease_out(age), paint_stroke(PAL['gold'], ta * (1 - age) ** 2 * 0.8, 2.0, blur=2))
        # the presence: warm motes drawn toward the tablet after the dot
        pres = hall * smooth(lin(t, B(75), B(76)))
        if pres > 0:
            dust(c, t, pres * 0.9, col=PAL['gold'], n=110, seed=111, spin=(W / 2, cyf, 0.35 + 0.15 * math.sin(t)), hat=A.hat_env(t))
        # incense smoke in front
        sm = hall * (0.6 + 0.4 * zoom)
        for k, xx in enumerate((W / 2 - 22, W / 2, W / 2 + 22)):
            E.draw_incense(c, xx, 1000, 480 + 60 * k, sm * 0.9, t, seed=k * 2.1, stick=60)
        E.draw_censer(c, W / 2, 1010, 120, hall * (1 - 0.0 * zoom))
    # --- pre-drop: 祭 · 如 · 在 (bars 81-83)
    pd = lin(t, B(81), B(83))
    if pd > 0 and t < B(83) + 0.2:
        dark = smooth(lin(t, B(81), B(81) + 0.8))
        c.drawRect(skia.Rect.MakeWH(W, H), paint_fill((0, 0, 0), 0.72 * dark * vis))
        for i, ch in enumerate('祭如在'):
            tc = B(81) + i * 1.0
            u = lin(t, tc - 0.02, tc + 0.5)
            if u <= 0:
                continue
            ts = 170
            f = font('serif_sb', ts)
            cw = adv('serif_sb', ts, ch)
            x = W / 2 + (i - 1) * 260 - cw / 2
            y = H / 2 + 60 + (1 - ease_out(u)) * 20
            build = lin(t, B(82), B(83))
            gl = 0.3 + 0.9 * build ** 2
            c.drawString(ch, x, y, f, paint_fill(PAL['gold'], vis * ease_out(u) * gl * 0.6, blur=22))
            c.drawString(ch, x, y, f, paint_fill(PAL['pale'], vis * ease_out(u), blur=(1 - ease_out(u)) * 8))


# ===================================================================== movement 6 · 如在
def act_presence(c, arr, t, A):
    vis = window(t, B(83), B(99) + 0.12, 0.02, 0.12)
    if vis <= 0:
        return
    kick = A.kick(t, 0.2)
    flash = math.exp(-(t - B(83)) / 0.6) if t >= B(83) else 0
    # 6a · 祭如在: a constellation of presences (bars 83-87)
    a1 = vis * (1 - smooth(lin(t, B(87) - 0.3, B(87) + 0.5)))
    if a1 > 0.003:
        age = t - B(83)
        for i in range(260):
            ang = hash1(i, 121) * 6.283
            sp = 120 + 520 * hash1(i, 122) ** 0.7
            r = sp * (1 - math.exp(-age / 1.6))
            x = W / 2 + math.cos(ang) * r * 1.5
            y = H / 2 - 40 + math.sin(ang) * r * 0.85 - age * 6 * hash1(i, 123)
            tw = 0.6 + 0.4 * math.sin(t * 2 + i)
            a = a1 * tw * (0.35 + 0.65 * hash1(i, 124)) * (0.7 + 0.5 * kick)
            col = PAL['gold'] if hash1(i, 125) > 0.3 else PAL['pale']
            radial_glow(c, x, y, 5 + 9 * hash1(i, 126), col, a)
        E.draw_tablet(c, W / 2, H / 2 - 30, 80, 260, a1 * (0.35 + 0.6 * flash), glow=0.6 + flash)
        radial_glow(c, W / 2, H / 2 - 40, 300 + 1200 * flash, PAL['pale'], flash * 1.3 * vis)
        for kt in A.kicks:
            if B(83) <= kt <= t and t - kt < 1.0:
                ag = (t - kt)
                c.drawCircle(W / 2, H / 2 - 40, 140 + 600 * ease_out(ag), paint_stroke(PAL['gold'], a1 * 0.4 * (1 - ag) ** 2, 2.0))
    # 6b · 清明 rain (bars 87-91)
    a2 = vis * window(t, B(87) - 0.3, B(91) + 0.3, 0.6, 0.6)
    if a2 > 0.003:
        gy = 800
        drift = (t - B(87)) * 6
        # far hills in mist
        hills = skia.Path()
        hills.moveTo(0, gy - 40)
        for i in range(49):
            x = i * W / 48
            hills.lineTo(x, gy - 60 - 70 * (0.5 + 0.5 * math.sin(i * 0.33 + 1.2)) * (0.6 + 0.4 * hash1(i, 136)))
        hills.lineTo(W, gy)
        hills.lineTo(0, gy)
        hills.close()
        c.drawPath(hills, paint_fill((0.07, 0.09, 0.11), a2 * 0.8, blur=3))
        c.drawRect(skia.Rect.MakeLTRB(0, gy, W, H), paint_fill((0.03, 0.04, 0.05), a2 * 0.8))
        c.drawLine(0, gy, W, gy, paint_stroke(PAL['moon'], a2 * 0.18, 1.0))
        # willow over the top-left (清明插柳)
        E.draw_willow(c, -80, -30, a2 * 0.9, t)
        # the stele, flowers, incense
        stx = W / 2 + 230 - drift
        E.draw_stele(c, stx, gy + 10, 230, 540, a2)
        for (fx, fy, fr, col) in [(stx - 210, gy - 30, 62, PAL['moon']), (stx - 285, gy - 75, 52, PAL['moon']),
                                  (stx - 150, gy - 92, 48, (1.0, 0.86, 0.48)), (stx - 240, gy - 140, 44, PAL['moon'])]:
            c.drawLine(fx, fy, stx - 200, gy + 30, paint_stroke(PAL['jade'], a2 * 0.6, 1.6))
            E.draw_chrysanthemum(c, fx, fy, fr, a2, t, col=col)
        for k in range(3):
            E.draw_incense(c, stx - 40 + k * 26, gy + 20, 260, a2 * 0.9, t, seed=k * 1.3, stick=70)
        # rain: brightness pulses with kicks
        for i in range(320):
            sp = 1400 + 500 * hash1(i, 131)
            x0 = hash1(i, 132) * (W + 300) - 150
            y = (hash1(i, 133) * (H + 200) + sp * t) % (H + 200) - 100
            x = x0 - (y + 100) * 0.18
            L = 26 + 34 * hash1(i, 134)
            a = a2 * (0.16 + 0.30 * hash1(i, 135)) * (1 + 0.8 * kick)
            c.drawLine(x, y, x - L * 0.18, y + L, paint_stroke((0.75, 0.82, 0.95), a, 1.3))
        # ripples on the ground at kicks
        for kt in A.kicks:
            if B(87) <= kt <= t and t - kt < 0.9:
                ag = (t - kt) / 0.9
                for j in range(4):
                    rx = W / 2 - 700 + hash1(int(kt * 10), j) * 1400
                    ry = gy + 40 + 180 * hash1(int(kt * 10), j + 9)
                    c.drawOval(skia.Rect.MakeXYWH(rx - 90 * ag, ry - 10 * ag, 180 * ag, 20 * ag),
                               paint_stroke((0.75, 0.82, 0.95), a2 * 0.6 * (1 - ag), 1.2))
    # 6c · 除夕 table (bars 91-95)
    a3 = vis * window(t, B(91) - 0.3, B(95) + 0.3, 0.6, 0.6)
    if a3 > 0.003:
        draw_table(c, t, A, a3)
    # 6d · 中元 lanterns (bars 95-99)
    a4 = vis * window(t, B(95) - 0.3, B(99) + 0.1, 0.6, 0.1)
    if a4 > 0.003:
        draw_river(c, t, A, a4)


def draw_table(c, t, A, alpha):
    """除夕: the round table seen from the near seat; the far seat is set for the absent."""
    cx, cy, R, tilt = W / 2, 560, 470, 0.46
    kick = A.kick(t, 0.2)
    # fireworks above, on every half bar
    for b_ in range(90, 95):
        for half in (0, 1):
            te = B(b_) + half * 1.0
            if te > t or t - te > 1.8 or te < B(91) - 0.6:
                continue
            fx = (0.15 + 0.70 * hash1(b_ * 3 + half, 141)) * W
            fy = (0.10 + 0.14 * hash1(b_ * 3 + half, 142)) * H
            age = (t - te) / 1.8
            colf = [PAL['gold'], PAL['cinnabar'], PAL['pale'], (1.0, 0.6, 0.3)][(b_ * 2 + half) % 4]
            for i in range(36):
                ang = 2 * math.pi * i / 36 + hash1(b_, half)
                rr = 170 * ease_out(age, 2) * (0.85 + 0.15 * hash1(i, b_))
                x = fx + math.cos(ang) * rr
                y = fy + math.sin(ang) * rr + 70 * age * age
                c.drawLine(x, y, x - math.cos(ang) * 14 * (1 - age), y - math.sin(ang) * 14 * (1 - age),
                           paint_stroke(colf, alpha * (1 - age) ** 1.5, 2.0))
            radial_glow(c, fx, fy, 220, colf, alpha * 0.25 * (1 - age) ** 2)
    radial_glow(c, cx, cy, R * 1.6, (0.9, 0.35, 0.18), alpha * 0.30)
    # hanging lantern glow
    radial_glow(c, cx, 70, 380, PAL['cinnabar'], alpha * 0.35)
    lit_count = sum(1 for kt in A.kicks if B(91) <= kt <= t)
    def P(x, y):
        return cx + x, cy + y * tilt
    c.save()
    c.translate(cx, cy)
    c.scale(1, tilt)
    c.drawCircle(0, 0, R, paint_fill((0.26, 0.05, 0.04), alpha * 0.95))
    c.drawCircle(0, 0, R, paint_stroke(PAL['gold'], alpha * 0.9, 2.4))
    c.drawCircle(0, 0, R * 0.95, paint_stroke(PAL['gold'], alpha * 0.35, 1.2))
    for (dx, dy, rr) in [(0, 0, 105), (-190, -60, 62), (190, -60, 62), (-170, 110, 58), (170, 110, 58), (0, -150, 52)]:
        c.drawCircle(dx, dy, rr, paint_fill((0.92, 0.88, 0.80), alpha * 0.16))
        c.drawCircle(dx, dy, rr, paint_stroke(PAL['moon'], alpha * 0.75, 1.6))
        c.drawCircle(dx, dy, rr * 0.78, paint_stroke(PAL['moon'], alpha * 0.3, 1.0))
    fish = skia.Path()
    fish.moveTo(-70, 0)
    fish.cubicTo(-35, -36, 35, -34, 56, 0)
    fish.cubicTo(35, 34, -35, 36, -70, 0)
    fish.moveTo(56, 0)
    fish.lineTo(84, -22)
    fish.lineTo(76, 0)
    fish.lineTo(84, 22)
    fish.close()
    glow_path(c, fish, PAL['gold'], alpha, 2.0, 0.8, 8)
    for i in range(8):
        ang = -math.pi / 2 + i * math.pi / 4
        bx = math.cos(ang) * R * 0.76
        by = math.sin(ang) * R * 0.76
        absent = (i == 0)
        col = PAL['pale'] if absent else PAL['moon']
        lit = 1.0 if (lit_count > i or absent) else 0.0
        a = alpha * (0.5 + 0.5 * lit)
        if absent:
            gl = 0.7 + 0.3 * math.sin(t * 2.0) + 0.5 * kick
            radial_glow(c, bx, by, 150, PAL['gold'], alpha * 0.6 * gl)
        c.drawCircle(bx, by, 40, paint_fill((0.95, 0.92, 0.85), a * (0.40 if absent else 0.25)))
        c.drawCircle(bx, by, 40, paint_stroke(col, a, 2.0))
        c.drawCircle(bx, by, 28, paint_stroke(col, a * 0.5, 1.2))
        px_, py_ = -math.sin(ang), math.cos(ang)
        for o in (58, 68):
            x1 = bx + px_ * o - math.cos(ang) * 52
            y1 = by + py_ * o - math.sin(ang) * 52
            x2 = bx + px_ * o + math.cos(ang) * 52
            y2 = by + py_ * o + math.sin(ang) * 52
            c.drawLine(x1, y1, x2, y2, paint_stroke(PAL['gold'] if absent else col, a, 3.0))
    c.restore()
    # steam (upright, in screen space)
    for i in range(8):
        ang = -math.pi / 2 + i * math.pi / 4
        sx_, sy_ = P(math.cos(ang) * R * 0.76, math.sin(ang) * R * 0.76)
        lit = (lit_count > i) or i == 0
        if not lit:
            continue
        for k in range(2):
            pts = []
            for j in range(12):
                u = j / 11
                pts.append((sx_ + (k - 0.5) * 16 + math.sin(u * 5 + t * 1.5 + i + k) * 9 * u, sy_ - 10 - u * 110))
            glow_path(c, smooth_path(pts), PAL['pale'] if i == 0 else PAL['moon'], alpha * (0.5 if i == 0 else 0.3), 1.2, 0.8, 5)


def draw_river(c, t, A, alpha):
    hy = 430
    kick = A.kick(t, 0.25)
    # full moon of the fifteenth
    mx, my = W / 2 + 420, 200
    radial_glow(c, mx, my, 260, (0.85, 0.88, 1.0), alpha * 0.3)
    c.drawCircle(mx, my, 62, paint_fill((0.95, 0.94, 0.88), alpha * 0.95))
    stars(c, t, alpha * 0.5, ymax=hy - 10)
    # far bank
    bank = skia.Path()
    bank.moveTo(0, hy)
    for i in range(41):
        x = i * W / 40
        bank.lineTo(x, hy - 18 - 22 * hash1(i, 151) - 30 * max(0, math.sin(i * 0.37)) ** 4)
    bank.lineTo(W, hy)
    bank.close()
    c.drawPath(bank, paint_fill((0.01, 0.015, 0.03), alpha))
    c.drawLine(0, hy, W, hy, paint_stroke((0.6, 0.65, 0.8), alpha * 0.3, 1.0))
    # moon path on water
    for k in range(26):
        yy = hy + 12 + k * 22
        ww = 40 + k * 7 + 20 * math.sin(t * 1.5 + k)
        c.drawLine(mx - ww / 2 + 15 * math.sin(t + k * 0.7), yy, mx + ww / 2 + 15 * math.sin(t + k * 0.7), yy,
                   paint_stroke((0.85, 0.88, 1.0), alpha * 0.22 * (1 - k / 26), 2.0, blur=1.5))
    # water shimmer lines
    for i in range(70):
        z = hash1(i, 152)
        yy = hy + 10 + z ** 1.5 * (H - hy)
        xx = (hash1(i, 153) * W + t * 20 * (0.3 + z)) % W
        ww = 30 + 120 * z
        c.drawLine(xx, yy, xx + ww, yy, paint_stroke((0.4, 0.5, 0.75), alpha * 0.12 * (0.5 + z), 1.2))
    # lanterns: a steady stream + one born on every kick
    births = [B(95) - 9 + i * 0.32 for i in range(40)] + [kt for kt in A.kicks if B(95) <= kt <= t]
    lift = ease_in(lin(t, B(97), B(99)), 2)
    order = sorted(range(len(births)), key=lambda j: -(t - births[j]))
    for j in order:
        tb = births[j]
        age = t - tb
        if age < 0:
            continue
        x0 = W / 2 + (hash1(j, 154) - 0.5) * 2200
        z = 1.0 / (1.0 + age * 0.30)
        y = hy + (1180 - hy) * z
        x = W / 2 + (x0 - W / 2) * z + math.sin(t * 0.6 + j) * 14 * z
        s = 58 * z
        if y > H + 40:
            continue
        rise = lift * (0.5 + 0.5 * hash1(j, 155))
        y -= rise * (y - 60) * 0.9
        a = alpha * min(1, age / 0.6) * (1 - 0.3 * rise)
        colj = PAL['ember'] if j % 3 else PAL['cinnabar']
        E.draw_lantern(c, x, y, s * (1 - 0.4 * rise), a, t, seed=j, col=colj, refl=(1 - rise))
    if lift > 0:
        radial_glow(c, W / 2, 200, 900 * lift, PAL['gold'], alpha * lift * 0.5)


# ===================================================================== movement 7 · 城
@functools.lru_cache(maxsize=2)
def city_layout(seed=7):
    rng = np.random.default_rng(seed)
    blds = []
    x = -40
    while x < W + 40:
        w = rng.integers(70, 170)
        h = rng.integers(260, 640)
        if abs(x + w / 2 - 1260) < 90:
            h = 560
        blds.append((x, w, h))
        x += w + rng.integers(4, 22)
    wins = []
    for bi, (x, w, h) in enumerate(blds):
        cols = max(2, int((w - 16) // 18))
        rows = int((h - 30) // 24)
        for r in range(rows):
            for cc in range(cols):
                wx = x + 10 + cc * 18
                wy = H - h + 18 + r * 24
                wins.append((bi, wx, wy, rng.random(), rng.random()))
    return blds, wins


BALCONY = (1262.0, None)


def act_city(c, arr, t, A):
    vis = window(t, B(99), B(109) + 0.5, 0.05, 0.5)
    if vis <= 0:
        return
    blds, wins = city_layout()
    zoom = ease_io(lin(t, B(104), B(109) - 0.2))
    s = mix(1.0, 1.9, zoom)
    bx = 1262
    by = H - 560 + 140
    cam_x = mix(W / 2, bx, zoom * 0.9)
    cam_y = mix(H / 2, by - 40, zoom * 0.7)
    stars(c, t, vis * (0.15 + 0.6 * smooth(lin(t, B(107), B(109)))))
    # city glow on the low sky
    p = skia.Paint()
    p.setShader(skia.GradientShader.MakeLinear([skia.Point(0, H * 0.25), skia.Point(0, H)],
                                               [C(0.10, 0.06, 0.16, 0), C(0.28, 0.16, 0.22, 0.55 * vis), C(0.40, 0.22, 0.18, 0.7 * vis)],
                                               [0, 0.6, 1]))
    c.drawRect(skia.Rect.MakeWH(W, H), p)
    c.save()
    c.translate(W / 2, H / 2)
    c.scale(s, s)
    c.translate(-cam_x, -cam_y)
    # far skyline (parallax-less, misty)
    for i in range(40):
        x = i * 52 - 30
        h = 300 + 380 * hash1(i, 161) ** 1.5
        c.drawRect(skia.Rect.MakeXYWH(x, H - h - 40, 46, h + 200), paint_fill((0.09, 0.08, 0.15), vis * 0.85))
        for r in range(int(h // 30)):
            if hash1(i * 37 + r, 162) < 0.3:
                c.drawRect(skia.Rect.MakeXYWH(x + 8 + 18 * (r % 2), H - h - 30 + r * 30, 7, 10),
                           paint_fill((0.9, 0.7, 0.5), vis * 0.18))
    # skyline
    for (x, w, h) in blds:
        c.drawRect(skia.Rect.MakeXYWH(x, H - h, w, h + 200), paint_fill((0.018, 0.020, 0.036), vis))
        c.drawLine(x, H - h, x + w, H - h, paint_stroke((0.35, 0.40, 0.60), vis * 0.35, 1.0))
    # windows: lit in a sweep at bar 101's downbeat (the hit)
    on_t = B(101)
    groups = {}
    for (bi, wx, wy, r1, r2) in wins:
        thr = 0.18
        if t >= on_t:
            sweep = clamp((t - on_t) * 4.0 - (wx / W) * 1.2)
            thr = 0.18 + 0.5 * sweep
        if r1 < thr:
            warm = r2 > 0.3
            colw = (1.0, 0.72, 0.38) if warm else (0.70, 0.80, 1.0)
            k = (warm, round((0.35 + 0.65 * r2) * 4) / 4)
            groups.setdefault(k, []).append(skia.Rect.MakeXYWH(wx, wy, 10, 14))
    for (warm, lv), rects in groups.items():
        colw = (1.0, 0.72, 0.38) if warm else (0.70, 0.80, 1.0)
        p = paint_fill(colw, vis * 0.55 * lv)
        for r in rects:
            c.drawRect(r, p)
    # the balcony
    ba = vis * smooth(lin(t, B(103), B(104) + 0.5))
    if ba > 0.003:
        c.drawLine(bx - 46, by, bx + 46, by, paint_stroke(PAL['moon'], ba * 0.7, 1.6))
        for k in range(9):
            c.drawLine(bx - 44 + k * 11, by, bx - 44 + k * 11, by + 22, paint_stroke(PAL['moon'], ba * 0.5, 1.0))
        c.drawRect(skia.Rect.MakeXYWH(bx - 30, by - 70, 60, 70), paint_fill((0.9, 0.7, 0.4), ba * 0.35))
        # the incense: sparks on the drum burst, lit at bar 105
        burst = [209.365, 209.431, 209.498, 209.623, 209.872, 210.122]
        for i, te in enumerate(burst):
            if 0 <= t - te < 0.6:
                sparks(c, t, te, bx, by - 12, n=10, alpha=ba, speed=160, life=0.6, seed=i + 300, spread=0.8)
        lit = smooth(lin(t, burst[0], B(105) + 0.2))
        if lit > 0:
            hsm = 60 + 900 * ease_in(lin(t, B(105), B(109)), 1.4)
            E.draw_incense(c, bx, by, hsm, ba * lit, t, seed=5, stick=14, smoke=1.0, col=PAL['pale'])
            radial_glow(c, bx, by - 14, 40, PAL['ember'], ba * lit)
    c.restore()


# ===================================================================== movement 8 · 显 (convergence)
def act_convergence(c, arr, t, A):
    vis = window(t, B(109), B(116) + 0.3, 0.02, 0.3)
    if vis <= 0:
        return
    kick = A.kick(t, 0.2)
    flash = math.exp(-(t - B(109)) / 0.6) if t >= B(109) else 0
    collapse = ease_in(lin(t, B(115), B(115) + 1.6), 2)
    a = vis * (1 - collapse)
    ox, oy = W / 2 + 120, 760        # the window (after the city zoom it sits here)
    stars(c, t, vis * 0.9)
    # city silhouette receding at the bottom, windows pulsing
    for i in range(30):
        x = i * 70 - 20
        h = 140 + 160 * hash1(i, 171)
        c.drawRect(skia.Rect.MakeXYWH(x, H - h, 62, h), paint_fill((0.02, 0.02, 0.035), vis))
        for r in range(int(h // 26)):
            if hash1(i * 31 + r, 172) < 0.45:
                c.drawRect(skia.Rect.MakeXYWH(x + 10 + 22 * (r % 2), H - h + 14 + r * 26, 9, 12),
                           paint_fill((1.0, 0.72, 0.38), vis * (0.4 + 0.5 * kick * hash1(i, r))))
    # axis of light from the window to the sky
    top = mix(oy, -60, ease_out(lin(t, B(109), B(110)), 2))
    for wdt, aa, bl in ((90, 0.10, 40), (22, 0.35, 10), (3.5, 1.0, 0)):
        c.drawLine(ox, oy, ox, top, paint_stroke(PAL['pale'], a * aa * (1 + 0.6 * kick), wdt, blur=bl))
    # 建木 sprouting from the axis, one tier per bar
    g = clamp(lin(t, B(109), B(113)))
    E.draw_tree(c, ox, oy, 560, g, a * 0.85, t, flow=a)
    # altar rings around the window, tilted, pulsing with kicks
    c.save()
    c.translate(ox, oy)
    c.scale(1, 0.32)
    for kt in A.kicks:
        if B(109) <= kt <= t and t - kt < 2.0:
            ag = (t - kt) / 2.0
            c.drawCircle(0, 0, 60 + 900 * ease_out(ag), paint_stroke(PAL['gold'], a * 0.55 * (1 - ag) ** 2, 3.0, blur=2))
    E.draw_yuanqiu(c, 0, 0, 420 * ease_out(lin(t, B(109), B(111))), t, rings=27, rails=1, stairs=1, walls=0.6,
                   alpha=a * 0.6, rot=t * 0.05, center_glow=1 + kick)
    c.restore()
    # sun-bird at the top of the axis
    sb = a * smooth(lin(t, B(110), B(111)))
    E.draw_sunbird(c, ox, 170, 120 * (1 + 0.03 * kick), sb, t, rot=t * 0.6)
    # presences descending along the axis
    falling_lights(c, t, a * 0.8, ox, -20, oy, n=50, spread=160, seed=181, speed=0.45)
    dust(c, t, a * 0.7, col=PAL['gold'], n=120, seed=191, hat=A.hat_env(t), spin=(ox, oy - 250, 0.15))
    radial_glow(c, ox, oy, 120 + 900 * flash, PAL['pale'], flash * 1.4 * vis)
    radial_glow(c, ox, oy, 60, PAL['pale'], a * (0.8 + kick))
    # collapse to a point on the last kick
    if collapse > 0:
        radial_glow(c, ox, oy, 400 * (1 - collapse) + 6, PAL['pale'], vis * (1.2 - collapse))


# ===================================================================== movement 9 · 回
def act_return(c, arr, t, A):
    vis = window(t, B(116), 253.97, 1.0, 2.2)
    if vis <= 0:
        return
    kick = A.kick(t, 0.4)
    sx, sy = W / 2, 640
    pulse = math.exp(-(t - B(119)) / 1.2) if t >= B(119) else 0
    # faint horizon of dawn
    radial_glow(c, W / 2, 900, 1300, (0.55, 0.30, 0.20), vis * 0.18 * smooth(lin(t, B(117), B(122))))
    c.drawLine(0, 760, W, 760, paint_stroke(PAL['moon'], vis * 0.12, 1.0))
    E.draw_stone(c, sx, sy, 130, glow=0.15 + 0.6 * pulse, alpha=vis, lines=0.25 + 0.75 * pulse, t=t)
    # a thread of incense smoke rising from beside the stone
    E.draw_incense(c, sx + 150, 700, 260 + 380 * smooth(lin(t, B(119), B(121))), vis, t, seed=9, stick=50, col=PAL['pale'])
    # heaven reappears far above, joined by the thread (bar 119+)
    hv = vis * smooth(lin(t, B(119), B(120) + 0.5))
    if hv > 0.003:
        E.draw_heaven(c, sx + 150, 150, 54, hv * 0.6, t, rot=t * 0.02)
        for i in range(30):
            yy = 600 - i * 15
            if yy < 210:
                break
            a = hv * 0.3 * (0.6 + 0.4 * math.sin(t * 2 - i * 0.4))
            c.drawCircle(sx + 150, yy, 1.6, paint_fill(PAL['pale'], a))
    dust(c, t, vis * 0.5, col=PAL['moon'], n=80, seed=201)
