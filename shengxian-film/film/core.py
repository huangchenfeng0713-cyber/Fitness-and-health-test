"""Core utilities: timing grid, audio envelopes, easing, noise, fonts, text, post."""
import math
import os
import functools
import numpy as np
import cv2
import skia

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

W, H = 1920, 1080
T0, BEAT = 0.122, 0.5          # 120 BPM grid fitted to the song
BAR = 4 * BEAT
DURATION = 253.9735


def bar(b):
    """Start time (s) of bar b (0-based)."""
    return T0 + BAR * b


def beat(k):
    return T0 + BEAT * k


# ----------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lin(t, a, b):
    """0..1 ramp between times a and b."""
    if b <= a:
        return 1.0 if t >= b else 0.0
    return clamp((t - a) / (b - a))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def smoother(x):
    x = clamp(x)
    return x * x * x * (x * (x * 6 - 15) + 10)


def ease_out(x, p=3):
    x = clamp(x)
    return 1 - (1 - x) ** p


def ease_in(x, p=3):
    x = clamp(x)
    return x ** p


def ease_io(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def window(t, a, b, fi=0.6, fo=0.6):
    """1 inside [a,b] with smooth fade in/out."""
    return smooth(lin(t, a, a + fi)) * (1 - smooth(lin(t, b - fo, b)))


def mix(a, b, x):
    return a + (b - a) * x


def mixc(c1, c2, x):
    return tuple(mix(p, q, x) for p, q in zip(c1, c2))


def hash1(i, salt=0):
    """Deterministic pseudo-random in [0,1)."""
    x = math.sin(i * 12.9898 + salt * 78.233 + 0.5) * 43758.5453
    return x - math.floor(x)


# ----------------------------------------------------------------- audio
class Audio:
    def __init__(self, path=os.path.join(ROOT, 'data', 'audio_features.npz')):
        d = np.load(path)
        self.t = d['t']
        self.dt = float(self.t[1] - self.t[0])
        self.kick_on = d['kick_on']
        self.snare_on = d['snare_on']
        self.hat_on = d['hat_on']
        self.sub = d['sub']
        self.hat = d['hat']
        self.loud = d['loud']
        # kicks snapped to the grid: beats whose sub-bass onset is strong
        self.kicks = []
        for k in range(int((DURATION - T0) / BEAT) + 1):
            tb = beat(k)
            i = int(round(tb / self.dt))
            seg = self.kick_on[max(0, i - 2):i + 5]
            if len(seg) and seg.max() > 0.32 and self.sub[i:i + 8].max() > 0.35:
                self.kicks.append(tb)
        self.kicks = np.array(self.kicks)

    def _at(self, arr, t):
        x = t / self.dt
        i = int(x)
        if i < 0:
            return float(arr[0])
        if i >= len(arr) - 1:
            return float(arr[-1])
        f = x - i
        return float(arr[i] * (1 - f) + arr[i + 1] * f)

    def env(self, arr, t, decay=0.18, win=0.8):
        """Peak-hold envelope with exponential decay of an onset signal."""
        i1 = int(t / self.dt)
        i0 = max(0, i1 - int(win / self.dt))
        if i1 <= 0:
            return 0.0
        seg = arr[i0:i1 + 1]
        ages = (i1 - np.arange(i0, i1 + 1)) * self.dt
        return float(np.max(seg * np.exp(-ages / decay)))

    def kick(self, t, decay=0.16):
        """Envelope from grid-snapped kicks (clean visual pulses)."""
        k = self.kicks
        j = np.searchsorted(k, t + 1e-6) - 1
        if j < 0:
            return 0.0
        return math.exp(-(t - k[j]) / decay)

    def hat_env(self, t):
        return min(1.0, self.env(self.hat_on, t, 0.08, 0.3))

    def snare_env(self, t):
        return min(1.0, self.env(self.snare_on, t, 0.10, 0.4))

    def level(self, t):
        return self._at(self.loud, t)


# ----------------------------------------------------------------- color
def C(r, g, b, a=1.0):
    return skia.Color4f(float(r), float(g), float(b), float(clamp(a)))


PAL = dict(
    night=(0.016, 0.020, 0.040),
    indigo=(0.055, 0.075, 0.150),
    gold=(0.96, 0.78, 0.46),
    pale=(1.00, 0.93, 0.78),
    ember=(1.00, 0.50, 0.20),
    cinnabar=(0.86, 0.20, 0.15),
    jade=(0.58, 0.82, 0.72),
    moon=(0.94, 0.92, 0.87),
    sky=(0.40, 0.55, 0.90),
    bone=(0.90, 0.84, 0.72),
)


def paint_stroke(col, alpha=1.0, width=1.5, blur=0.0, cap=skia.Paint.kRound_Cap):
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kStroke_Style, StrokeWidth=width,
                   StrokeCap=cap, StrokeJoin=skia.Paint.kRound_Join)
    p.setColor4f(C(*col[:3], alpha))
    if blur > 0:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    return p


def paint_fill(col, alpha=1.0, blur=0.0, blend=None):
    p = skia.Paint(AntiAlias=True, Style=skia.Paint.kFill_Style)
    p.setColor4f(C(*col[:3], alpha))
    if blur > 0:
        p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, blur))
    if blend is not None:
        p.setBlendMode(blend)
    return p


def glow_path(canvas, path, col, alpha=1.0, width=1.6, glow=1.0, glow_w=10.0):
    """Luminous line: soft wide halo + crisp core."""
    if alpha <= 0.002:
        return
    if glow > 0:
        canvas.drawPath(path, paint_stroke(col, alpha * 0.35 * glow, width * 3.5, glow_w))
    canvas.drawPath(path, paint_stroke(col, alpha, width))


def radial_glow(canvas, x, y, r, col, alpha=1.0):
    if alpha <= 0.002 or r <= 0:
        return
    p = skia.Paint(AntiAlias=True)
    p.setShader(skia.GradientShader.MakeRadial(
        skia.Point(x, y), r,
        [C(*col, alpha), C(*col, alpha * 0.35), C(*col, 0)],
        [0.0, 0.35, 1.0]))
    canvas.drawCircle(x, y, r, p)


def poly_path(pts, closed=False):
    path = skia.Path()
    if len(pts) == 0:
        return path
    path.moveTo(*pts[0])
    for p in pts[1:]:
        path.lineTo(*p)
    if closed:
        path.close()
    return path


def smooth_path(pts, closed=False):
    """Catmull-Rom through points -> cubic path."""
    n = len(pts)
    path = skia.Path()
    if n < 3:
        return poly_path(pts, closed)
    P = list(pts)
    if closed:
        P = [pts[-1]] + list(pts) + [pts[0], pts[1]]
    else:
        P = [pts[0]] + list(pts) + [pts[-1]]
    path.moveTo(*P[1])
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        path.cubicTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if closed:
        path.close()
    return path


# ----------------------------------------------------------------- noise
class Noise:
    """Animated value-noise fBm on small grids, upsampled with cv2 (fast)."""

    def __init__(self, seed=1, base=(6, 10), octaves=5, slices=48):
        rng = np.random.default_rng(seed)
        self.oct = []
        gh, gw = base
        for o in range(octaves):
            self.oct.append(rng.random((slices, gh, gw)).astype(np.float32))
            gh, gw = gh * 2, gw * 2
        self.slices = slices

    def field(self, w, h, t, speed=0.15, drift=(0.0, 0.0), octaves=None, gain=0.5, scale=1.0):
        out = np.zeros((h, w), np.float32)
        amp, tot = 1.0, 0.0
        for o, g in enumerate(self.oct[:octaves or len(self.oct)]):
            s = t * speed * (1 + o * 0.35)
            i0 = int(math.floor(s)) % self.slices
            f = s - math.floor(s)
            f = f * f * (3 - 2 * f)
            grid = g[i0] * (1 - f) + g[(i0 + 1) % self.slices] * f
            gh, gw = grid.shape
            sx = gw / (w * scale)
            sy = gh / (h * scale)
            ox = drift[0] * t * (1 + o * 0.5) * gw
            oy = drift[1] * t * (1 + o * 0.5) * gh
            M = np.float32([[sx, 0, ox], [0, sy, oy]])
            layer = cv2.warpAffine(grid, M, (w, h), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP,
                                   borderMode=cv2.BORDER_WRAP)
            out += layer * amp
            tot += amp
            amp *= gain
        return out / tot


# ----------------------------------------------------------------- fonts & text
FONT_DIR = os.environ.get('SX_FONTS', os.path.join(ROOT, 'fonts'))
FONTS = {
    'serif_l': 'NotoSerifCJKsc-Light.otf',
    'serif': 'NotoSerifCJKsc-Regular.otf',
    'serif_sb': 'NotoSerifCJKsc-SemiBold.otf',
    'serif_b': 'NotoSerifCJKsc-Black.otf',
    'kai': 'LXGWWenKai-Regular.ttf',
    'kai_l': 'LXGWWenKai-Light.ttf',
    'brush': 'MaShanZheng-Regular.ttf',
    'latin': 'CormorantGaramond[wght].ttf',
}


@functools.lru_cache(maxsize=None)
def typeface(name):
    tf = skia.Typeface.MakeFromFile(os.path.join(FONT_DIR, FONTS[name]))
    if tf is None:
        raise RuntimeError('font missing: ' + name)
    return tf


@functools.lru_cache(maxsize=4096)
def font(name, size):
    f = skia.Font(typeface(name), size)
    f.setSubpixel(True)
    f.setEdging(skia.Font.Edging.kSubpixelAntiAlias)
    return f


@functools.lru_cache(maxsize=65536)
def adv(name, size, ch):
    return font(name, size).measureText(ch)


VERT = {'，': '︐', '。': '︒', '、': '︑', '：': '︓', '；': '︔', '！': '︕', '？': '︖',
        '“': '﹁', '”': '﹂', '《': '︽', '》': '︾', '（': '︵', '）': '︶', '—': '︱', '…': '︙'}


def draw_text(canvas, text, x, y, size=44, face='serif_l', col=PAL['moon'], alpha=1.0,
              track=0.08, align='center', reveal=1.0, rise=10.0, blur_in=6.0, stagger=0.55,
              shadow=0.55, glow=0.0, glow_col=None):
    """Horizontal text with per-character reveal (0..1 for the whole line).

    stagger: fraction of the reveal spent staggering characters across the line.
    """
    if alpha <= 0.003 or not text:
        return 0
    chars = list(text)
    ws = [adv(face, size, c) for c in chars]
    tr = size * track
    total = sum(ws) + tr * (len(chars) - 1)
    if align == 'center':
        x0 = x - total / 2
    elif align == 'right':
        x0 = x - total
    else:
        x0 = x
    n = len(chars)
    f = font(face, size)
    cx = x0
    for i, c in enumerate(chars):
        if n > 1:
            st = stagger * i / (n - 1)
        else:
            st = 0.0
        local = clamp((reveal - st) / max(1e-6, (1 - stagger)))
        a = alpha * smooth(local)
        if a > 0.003 and not c.isspace():
            dy = (1 - ease_out(local)) * rise
            bl = (1 - ease_out(local)) * blur_in
            if shadow > 0:
                ps = paint_fill((0, 0, 0), a * shadow, blur=size * 0.22)
                canvas.drawString(c, cx, y + dy + size * 0.04, f, ps)
            if glow > 0:
                pg = paint_fill(glow_col or col, a * glow, blur=size * 0.35)
                canvas.drawString(c, cx, y + dy, f, pg)
            p = paint_fill(col, a, blur=bl if bl > 0.3 else 0)
            canvas.drawString(c, cx, y + dy, f, p)
        cx += ws[i] + tr
    return total


def draw_vtext(canvas, text, x, y, size=30, face='kai', col=PAL['moon'], alpha=1.0,
               lead=1.18, reveal=1.0, stagger=0.6, shadow=0.5, col_gap=1.7):
    """Vertical text (top-to-bottom, columns right-to-left split by '|')."""
    if alpha <= 0.003:
        return
    cols = text.split('|')
    f = font(face, size)
    allc = sum(len(c) for c in cols)
    k = 0
    for ci, colt in enumerate(cols):
        cx = x - ci * size * col_gap
        cy = y
        for c in colt:
            g = VERT.get(c, c)
            st = stagger * k / max(1, allc - 1)
            local = clamp((reveal - st) / max(1e-6, (1 - stagger)))
            a = alpha * smooth(local)
            w = adv(face, size, g)
            if a > 0.003 and not c.isspace():
                if shadow > 0:
                    canvas.drawString(g, cx - w / 2, cy + size * 0.88, f, paint_fill((0, 0, 0), a * shadow, blur=size * 0.2))
                canvas.drawString(g, cx - w / 2, cy + size * 0.88, f,
                                  paint_fill(col, a, blur=(1 - ease_out(local)) * 4))
            cy += size * lead
            k += 1


# ----------------------------------------------------------------- post
_vig = None
_grain = None


def _vignette():
    global _vig
    if _vig is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nx = (xx / W - 0.5) * 2
        ny = (yy / H - 0.5) * 2
        r = np.sqrt(nx * nx * 0.75 + ny * ny * 1.0)
        _vig = np.clip(1.0 - 0.42 * smooth_np(np.clip((r - 0.35) / 1.0, 0, 1)), 0, 1)[..., None]
    return _vig


def smooth_np(x):
    return x * x * (3 - 2 * x)


def _grain_tiles():
    global _grain
    if _grain is None:
        rng = np.random.default_rng(7)
        _grain = [rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32) for _ in range(6)]
    return _grain


def bloom(img, thresh=0.55, strength=0.9, radius_scale=1.0):
    """img float32 HxWx3 in 0..1+. Returns img + bloom."""
    b = np.maximum(img - thresh, 0)
    small = cv2.resize(b, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    acc = np.zeros_like(small)
    lvl = small
    weights = [0.30, 0.30, 0.25, 0.20, 0.18]
    for i, wgt in enumerate(weights):
        lvl = cv2.resize(lvl, (max(1, lvl.shape[1] // 2), max(1, lvl.shape[0] // 2)), interpolation=cv2.INTER_AREA)
        k = int(5 * radius_scale) | 1
        bl = cv2.GaussianBlur(lvl, (k, k), 0)
        acc += cv2.resize(bl, (W // 2, H // 2), interpolation=cv2.INTER_LINEAR) * wgt
    up = cv2.resize(acc, (W, H), interpolation=cv2.INTER_LINEAR)
    return img + up * strength


def finish(img, frame_idx, grain=0.022, vignette=True, exposure=1.0, lift=0.0):
    """Tonemap, vignette, grain -> uint8 RGB."""
    x = img * exposure
    # soft shoulder tonemap
    x = x / (1.0 + np.maximum(x - 0.8, 0) * 0.9)
    if lift:
        x = x + lift * (1 - x)
    if vignette:
        x = x * _vignette()
    g = _grain_tiles()[(frame_idx // 2) % 6]
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    lum = x.mean(axis=2, keepdims=True)
    x = x + g * grain * (0.35 + 0.65 * np.sqrt(np.clip(lum, 0, 1)))
    out = np.clip(x * 255.0 + 0.5, 0, 255).astype(np.uint8)
    return cv2.LUT(out, _GAMMA_LUT)


_GAMMA_LUT = np.clip(((np.arange(256) / 255.0) ** 0.90) * 255.0 + 0.5, 0, 255).astype(np.uint8)
