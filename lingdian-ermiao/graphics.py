"""Generated shots for the film: cosmic calendar, 4000-weeks grid, Ken Burns stills.

Each generator streams RGB frames into ffmpeg and writes an H.264 file at FPS.
"""
import math
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FPS = 24
W, H = 1920, 1080
FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
_fonts = {}


def font(weight, size):
    key = (weight, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(f"{FONT_DIR}/NotoSerifSC-{weight}.otf", size)
    return _fonts[key]


def writer(path, n_frames):
    cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-frames:v", str(n_frames), "-c:v", "libx264", "-preset", "medium",
           "-crf", "14", "-pix_fmt", "yuv420p", path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def ramp(t, t0, dur):
    """0 before t0, smoothstep to 1 over dur."""
    return smooth((t - t0) / dur) if dur > 0 else float(t >= t0)


def starfield(seed=7, n=900):
    rng = np.random.default_rng(seed)
    yy = np.linspace(0, 1, H)[:, None]
    bg = np.zeros((H, W, 3), np.float32)
    top, bot = np.array([4, 6, 12], np.float32), np.array([10, 14, 28], np.float32)
    bg[:] = top + (bot - top) * yy[..., None]
    img = Image.fromarray(bg.astype(np.uint8))
    d = ImageDraw.Draw(img)
    for _ in range(n):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        b = rng.uniform(0.15, 0.75) ** 2
        r = 0.6 if rng.uniform() < 0.9 else 1.2
        c = tuple(int(v) for v in np.array([200, 210, 255]) * b)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    return img


def text_layer(draw, xy, s, fnt, alpha, fill=(255, 255, 255), anchor="mm"):
    if alpha <= 0.01:
        return
    draw.text(xy, s, font=fnt, fill=fill + (int(255 * alpha),), anchor=anchor)


# ---------------------------------------------------------------- cosmic calendar

MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
MONTH_START = np.cumsum([0] + MONTH_LEN)
SEC = 1 / 86400
EV_EARTH = 365 * (1 - 4.54 / 13.8)
EV_DINO = 365 * (1 - 0.233 / 13.8)
EV_DINO_END = 365 * (1 - 0.066 / 13.8)
EV_HUMAN = 365 - 300e3 / 13.8e9 * 365
EV_WRITING = 365 - 5200 / 13.8e9 * 365
LIFE = 80 / 13.8e9 * 365  # days


def day_to_date(d):
    d = min(d, 365 - 1e-12)
    m = int(np.searchsorted(MONTH_START, d, side="right") - 1)
    day = int(d - MONTH_START[m]) + 1
    secs = (d - math.floor(d)) * 86400
    return m + 1, day, secs


def fmt_clock(d, sub=False):
    m, day, s = day_to_date(d)
    hh, mm = int(s // 3600), int(s % 3600 // 60)
    ss = s % 60
    if sub:
        return f"{m}月{day}日  {hh:02d}:{mm:02d}:{ss:05.2f}"
    return f"{m}月{day}日  {hh:02d}:{mm:02d}:{int(ss):02d}"


def calendar(path, dur, k):
    """k: dict name -> seconds (relative to shot start) of each VO speech start."""
    n = int(round(dur * FPS))
    bg = starfield()
    X0, X1, BY = 170, 1750, 600
    BW = X1 - X0

    # window width (days, right-anchored at 365) keyframes: (t, W)
    t12, t13, t14, t15 = k["n12"], k["n13"], k["n14"], k["n15"]
    win_keys = [(0, 365.0), (t12 + 1.5, 365.0), (t12 + 2.9, 12.0), (t13 + 0.3, 12.0), (t13 + 1.7, 1.0),
                (t13 + 2.2, 1.0), (t13 + 3.4, 1 / 24), (t14 + 0.2, 1 / 24), (t14 + 1.6, 1 / 1440),
                (t15 + 0.2, 1 / 1440), (t15 + 1.8, 1 / 86400), (dur + 1, 1 / 86400)]
    # marker position (days) keyframes
    mk_keys = [(0, 0.0), (k["n11"] + 0.3, 0.0), (k["n11"] + 2.0, EV_EARTH), (t12 + 0.2, EV_EARTH),
               (t12 + 1.3, EV_DINO), (t12 + 3.0, EV_DINO), (t12 + 3.9, EV_DINO_END), (t13 + 0.3, EV_DINO_END),
               (t13 + 1.7, 364.0), (t13 + 3.4, 364 + 23 / 24), (t13 + 4.4, EV_HUMAN), (t14 + 1.6, EV_HUMAN),
               (t14 + 2.6, EV_WRITING), (t15 + 0.2, EV_WRITING), (t15 + 1.8, 365 - 1.0 * SEC),
               (t15 + 2.4, 365 - LIFE), (dur + 1, 365 - LIFE)]
    events = [  # (day, label, show time, row)
        (0.0, "1月1日 · 宇宙诞生", k["n10"] + 0.6, 0),
        (EV_EARTH, "9月2日 · 地球形成", k["n11"] + 2.0, 0),
        (EV_DINO, "12月25日 · 恐龙出现", t12 + 1.3, 0),
        (EV_DINO_END, "12月30日 · 恐龙灭绝", t12 + 3.9, 1),
        (EV_HUMAN, "23:48 · 智人出现", t13 + 4.4, 0),
        (EV_WRITING, "23:59:48 · 文字出现", t14 + 2.6, 1),
    ]
    levels = [  # (name, unit days, tick height)
        ("month", 30.4, 18), ("day", 1.0, 12), ("6h", 0.25, 10), ("3h", 0.125, 10), ("hour", 1 / 24, 10),
        ("15min", 1 / 96, 8), ("5min", 1 / 288, 8), ("min", 1 / 1440, 8), ("15s", 1 / 5760, 8),
        ("5s", 1 / 17280, 8), ("s", SEC, 8), ("0.2s", SEC / 5, 7), ("0.1s", SEC / 10, 6)]

    def interp(keys, t, log=False):
        for (ta, va), (tb, vb) in zip(keys, keys[1:]):
            if t <= tb:
                u = smooth((t - ta) / (tb - ta)) if tb > ta else 1
                if log:
                    return math.exp(math.log(va) + (math.log(vb) - math.log(va)) * u)
                return va + (vb - va) * u
        return keys[-1][1]

    def ticks_for(level, left, right):
        name, unit, _ = level
        if name == "month":
            return [(float(s), f"{i + 1}月") for i, s in enumerate(MONTH_START[:12]) if left - 31 <= s <= right]
        start = math.floor(left / unit) * unit
        out = []
        v = start
        while v <= right + unit * 0.5:
            if v >= left - 1e-12:
                m, day, s = day_to_date(v if v < 365 else 364.9999999)
                if v >= 365 - 1e-9:
                    lab = "24:00"
                elif name == "day":
                    lab = f"{day}日"
                elif name in ("6h", "3h", "hour"):
                    lab = f"{int(round(s / 3600)) % 24:02d}:00"
                elif name in ("15min", "5min", "min"):
                    lab = f"{int(s // 3600):02d}:{int(round(s % 3600 / 60)) % 60:02d}"
                elif name in ("15s", "5s", "s"):
                    lab = f"{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{int(round(s % 60)) % 60:02d}"
                else:
                    lab = f"{s % 60:04.1f}秒"
                out.append((v, lab))
            v += unit
            if len(out) > 400:
                break
        return out

    proc = writer(path, n)
    f_tick = font("Light", 26)
    f_ev = font("Regular", 34)
    f_clock = font("Light", 54)
    f_big = font("SemiBold", 168)
    f_mid = font("Light", 46)
    f_head = font("Light", 40)
    f_life = font("SemiBold", 56)
    for i in range(n):
        t = i / FPS
        img = bg.copy().convert("RGBA")
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)

        # intro number
        a_big = ramp(t, k["n08"] - 0.3, 0.9) * (1 - ramp(t, k["n09"] + 0.6, 0.9))
        text_layer(d, (W / 2, 470), "138 亿年", f_big, a_big)
        text_layer(d, (W / 2, 630), "宇宙的年龄", f_mid, a_big * 0.8)

        a_head = ramp(t, k["n09"] + 1.2, 1.0)
        text_layer(d, (W / 2, 190), "把宇宙 138 亿年的历史，压缩成一年", f_head, a_head * 0.85)

        # bar grows
        grow = ramp(t, k["n09"] + 0.8, 2.0)
        win = interp(win_keys, t, log=True)
        left, right = 365 - win, 365.0

        def px(dv):
            return X0 + (dv - left) / win * BW

        if grow > 0:
            d.line([(X0, BY), (X0 + BW * grow, BY)], fill=(255, 255, 255, int(150 * grow)), width=2)
            # ticks and labels
            fits = [lv for lv in levels if lv[1] / win * BW >= 95]
            label_level = min(fits, key=lambda lv: lv[1]) if fits else None
            for lv in levels:
                spacing = lv[1] / win * BW
                if spacing < 5:
                    continue
                ta = clamp((spacing - 5) / 25)
                for v, lab in ticks_for(lv, left, right):
                    x = px(v)
                    if x < X0 - 1 or x > X0 + BW * grow + 1:
                        continue
                    d.line([(x, BY - lv[2] / 2), (x, BY + lv[2] / 2)], fill=(255, 255, 255, int(170 * ta * grow)), width=2)
                    if lv is label_level:
                        la = clamp((spacing - 95) / 35) * grow
                        offs = spacing / 2 if lv[0] in ("month", "day") else 0
                        if lv[0] in ("month", "day") and x + offs > X1:
                            continue
                        text_layer(d, (x + offs, BY + 42), lab, f_tick, la * 0.75)

        # events
        for ev_day, lab, ts, row in events:
            ea = ramp(t, ts, 0.5)
            x = px(ev_day)
            if ea <= 0 or x < X0 - 2 or x > X1 + 2:
                continue
            edge = clamp((x - X0 + 30) / 30)
            ea *= edge
            ytop = BY - (95 if row == 0 else 165)
            d.line([(x, BY - 14), (x, ytop + 24)], fill=(255, 214, 140, int(160 * ea)), width=2)
            tx = min(max(x, 220), W - 230)
            text_layer(d, (tx, ytop), lab, f_ev, ea, fill=(255, 226, 170))

        # life segment
        la = ramp(t, t15 + 2.4, 0.7)
        if la > 0:
            xa, xb = px(365 - LIFE), px(365)
            xb_now = xa + (xb - xa) * la
            glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow)
            gd.rectangle([xa, BY - 9, xb_now, BY + 9], fill=(255, 200, 90, 200))
            layer.alpha_composite(glow.filter(ImageFilter.GaussianBlur(8)))
            d.rectangle([xa, BY - 5, xb_now, BY + 5], fill=(255, 220, 130, 255))
            a2 = ramp(t, t15 + 2.9, 0.8)
            text_layer(d, ((xa + xb) / 2 - 40, BY - 120), "你的一生 ≈ 0.18 秒", f_life, a2, fill=(255, 230, 175))
            text_layer(d, ((xa + xb) / 2 - 40, BY - 62), "（按 80 年计算）", f_tick, a2 * 0.7)

        # marker + clock
        ma = ramp(t, k["n10"] - 0.1, 0.6)
        if ma > 0:
            mday = interp(mk_keys, t)
            x = px(mday)
            if X0 - 4 <= x <= X1 + 4:
                halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                ImageDraw.Draw(halo).ellipse([x - 22, BY - 22, x + 22, BY + 22], fill=(255, 200, 110, int(140 * ma)))
                layer.alpha_composite(halo.filter(ImageFilter.GaussianBlur(10)))
                d.ellipse([x - 8, BY - 8, x + 8, BY + 8], fill=(255, 236, 190, int(255 * ma)))
            sub = win < 2 / 1440
            text_layer(d, (W / 2, 790), fmt_clock(mday, sub), f_clock, ma * 0.9)

        fade_out = 1 - ramp(t, dur - 0.6, 0.6)
        img.alpha_composite(layer)
        arr = np.asarray(img.convert("RGB"), np.float32) * fade_out
        proc.stdin.write(arr.astype(np.uint8).tobytes())
    proc.stdin.close()
    proc.wait()


# ---------------------------------------------------------------- 4000 weeks

def weeks(path, dur, t_vo):
    n = int(round(dur * FPS))
    bg = starfield(seed=11, n=500)
    cols, rows, pitch, cell = 52, 80, 12, 9
    gx, gy = 330, (H - rows * pitch) // 2
    f_big = font("SemiBold", 150)
    f_mid = font("Light", 52)
    f_small = font("Light", 32)
    proc = writer(path, n)
    rng = np.random.default_rng(3)
    jitter = rng.uniform(0, 0.25, (rows, cols))
    for i in range(n):
        t = i / FPS
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        prog = (t - (t_vo - 0.2)) / 3.2  # fraction of grid revealed
        for r in range(rows):
            for c in range(cols):
                a = clamp((prog - r / rows - jitter[r, c] * 0.1) * 12)
                if a <= 0:
                    continue
                x, y = gx + c * pitch, gy + r * pitch
                d.rectangle([x, y, x + cell, y + cell], fill=(235, 238, 245, int(200 * a)))
        ta = ramp(t, t_vo + 0.8, 0.8)
        text_layer(d, (1330, 470), "4000", f_big, ta, fill=(255, 230, 175))
        text_layer(d, (1330, 590), "个星期", f_mid, ta)
        text_layer(d, (1330, 680), "每一格，是一周", f_small, ramp(t, t_vo + 2.0, 0.8) * 0.7)
        img = bg.copy().convert("RGBA")
        img.alpha_composite(layer)
        fade = ramp(t, 0, 0.5) * (1 - ramp(t, dur - 0.5, 0.5))
        arr = np.asarray(img.convert("RGB"), np.float32) * fade
        proc.stdin.write(arr.astype(np.uint8).tobytes())
    proc.stdin.close()
    proc.wait()


# ---------------------------------------------------------------- Ken Burns stills

def kenburns(path, dur, image, start, end, crop_aspect=16 / 9, mark=None, ease=True):
    """start/end: (cx, cy, width) in image pixels. mark: (x, y, t_show, label) circle annotation."""
    src = Image.open(image).convert("RGB")
    n = int(round(dur * FPS))
    proc = writer(path, n)
    (cx0, cy0, w0), (cx1, cy1, w1) = start, end
    f_lab = font("Regular", 40)
    for i in range(n):
        u = i / max(1, n - 1)
        u = smooth(u) if ease else u
        w = math.exp(math.log(w0) + (math.log(w1) - math.log(w0)) * u)
        p = (w0 - w) / (w0 - w1) if w0 != w1 else u
        cx, cy = cx0 + (cx1 - cx0) * p, cy0 + (cy1 - cy0) * p
        h = w / crop_aspect
        box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
        frame = src.transform((W, H), Image.EXTENT, box, resample=Image.BICUBIC)
        if mark:
            mx, my, ts, lab = mark
            a = ramp(i / FPS, ts, 0.8)
            if a > 0:
                fx = (mx - box[0]) / w * W
                fy = (my - box[1]) / h * H
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                d = ImageDraw.Draw(lay)
                r = 34
                d.ellipse([fx - r, fy - r, fx + r, fy + r], outline=(255, 226, 170, int(220 * a)), width=2)
                d.line([(fx + r * 0.7, fy - r * 0.7), (fx + 90, fy - 90)], fill=(255, 226, 170, int(200 * a)), width=2)
                d.text((fx + 100, fy - 92), lab, font=f_lab, fill=(255, 236, 200, int(255 * a)), anchor="lm")
                frame = frame.convert("RGBA")
                frame.alpha_composite(lay)
                frame = frame.convert("RGB")
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
