"""Typography layer: renders the cues from script.py onto a transparent surface."""
import math
import skia
from .core import (W, H, PAL, clamp, lin, smooth, ease_out, paint_fill, draw_text, draw_vtext,
                   radial_glow, font, adv, bar)
from .script import CUES

MAIN_SIZE = 44
NOTE_SIZE = 25


def _env(t, t0, t1, fin=0.9, fout=0.7):
    """reveal (0..1), alpha (0..1) for a cue."""
    rev = clamp((t - t0) / fin)
    out = 1 - smooth(lin(t, t1 - fout, t1))
    return rev, out


def scrim(c, alpha, y0=H - 330):
    if alpha <= 0.003:
        return
    p = skia.Paint()
    p.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, y0), skia.Point(0, H)],
        [skia.Color4f(0, 0, 0, 0), skia.Color4f(0, 0, 0, 0.52 * alpha)], [0, 1]))
    c.drawRect(skia.Rect.MakeLTRB(0, y0, W, H), p)


def draw_main(c, t, cue):
    lines = cue['lines']
    n = len(lines)
    stag = cue.get('stagger_lines', 0.0)
    y_last = cue.get('y', 968 if cue.get('note') else 980)
    gap = MAIN_SIZE * 1.62
    note = cue.get('note')
    if note:
        y_last -= 52
    ys = [y_last - (n - 1 - i) * gap for i in range(n)]
    _, out = _env(t, cue['t0'], cue['t1'])
    scrim(c, out * clamp((t - cue['t0']) / 0.6))
    for i, (ln, y) in enumerate(zip(lines, ys)):
        t0 = cue['t0'] + i * stag
        rev = clamp((t - t0) / (0.7 + 0.035 * len(ln)))
        if rev <= 0:
            continue
        draw_text(c, ln, W / 2, y, size=MAIN_SIZE, face='serif_l', col=PAL['moon'], alpha=out,
                  reveal=rev, track=0.10, rise=8, blur_in=5, stagger=0.6, shadow=0.75)
    if note:
        t0 = cue['t0'] + 0.5 + (n - 1) * stag
        rev = clamp((t - t0) / 1.0)
        if rev > 0:
            draw_text(c, note, W / 2, y_last + 56, size=NOTE_SIZE, face='kai', col=PAL['gold'],
                      alpha=out * 0.92, reveal=rev, track=0.12, rise=4, blur_in=3, stagger=0.4, shadow=0.7)


def draw_title(c, t, cue):
    rev, out = _env(t, cue['t0'], cue['t1'], 0.5, 0.8)
    if out <= 0:
        return
    k = ease_out(clamp((t - cue['t0']) / 1.4), 3)
    size = 170
    s = 0.92 + 0.08 * k
    c.save()
    c.translate(W / 2, H / 2 - 20)
    c.scale(s, s)
    c.translate(-W / 2, -(H / 2 - 20))
    draw_text(c, '圣显', W / 2, H / 2 + 40, size=size, face='serif_sb', col=PAL['pale'], alpha=out,
              reveal=clamp((t - cue['t0']) / 0.35), track=0.55, rise=0, blur_in=14, stagger=0.3,
              shadow=0.6, glow=0.55, glow_col=PAL['gold'])
    c.restore()
    r2 = clamp((t - cue['t0'] - 0.9) / 1.2)
    draw_text(c, 'H I E R O P H A N Y', W / 2, H / 2 + 128, size=26, face='latin', col=PAL['gold'],
              alpha=out * 0.9, reveal=r2, track=0.2, rise=0, blur_in=4, stagger=0.6, shadow=0.5)
    r3 = clamp((t - cue['t0'] - 1.8) / 1.2)
    draw_text(c, '神圣的显现', W / 2, H / 2 + 182, size=28, face='serif_l', col=PAL['moon'],
              alpha=out * 0.85, reveal=r3, track=0.5, rise=4, blur_in=4, stagger=0.5, shadow=0.6)


def draw_quote(c, t, cue):
    rev, out = _env(t, cue['t0'], cue['t1'], 2.0, 0.8)
    if out <= 0:
        return
    side = cue.get('side', 'right')
    x = W - 190 if side == 'right' else 250
    y = 210
    size = 40
    draw_vtext(c, cue['text'], x, y, size=size, face='kai', col=PAL['pale'], alpha=out * 0.95,
               reveal=rev, lead=1.22, col_gap=1.6)
    # seal-like source mark
    r2 = clamp((t - cue['t0'] - 1.2) / 1.0)
    ncols = len(cue['text'].split('|'))
    sx = x - (ncols - 1) * size * 1.6 - size * 1.5
    draw_vtext(c, cue['source'], sx, y + size * 0.2, size=22, face='kai', col=PAL['gold'],
               alpha=out * 0.85 * r2, reveal=r2, lead=1.15)


def draw_bigquote(c, t, cue):
    rev, out = _env(t, cue['t0'], cue['t1'], 1.0, 0.8)
    if out <= 0:
        return
    ln = cue['lines'][0]
    size = 74
    y = H / 2 + 40
    if cue['t0'] > bar(100):
        y = 905
        scrim(c, out * clamp((t - cue['t0']) / 0.6), y0=H - 380)
    draw_text(c, ln, W / 2, y, size=size, face='serif', col=PAL['pale'], alpha=out, reveal=rev,
              track=0.22, rise=10, blur_in=10, stagger=0.55, shadow=0.7, glow=0.35, glow_col=PAL['gold'])
    r2 = clamp((t - cue['t0'] - 1.3) / 1.0)
    draw_text(c, cue['source'], W / 2, y + 78, size=30 if cue['t0'] > bar(100) else 28,
              face='kai' if cue['t0'] < bar(100) else 'serif_l', col=PAL['gold'] if cue['t0'] < bar(100) else PAL['moon'],
              alpha=out * 0.9, reveal=r2, track=0.14, rise=4, blur_in=3, stagger=0.5, shadow=0.7)


CREDITS = [
    ('参照　杨洁《寻找哲人石：伊利亚德的思想之钥研究》', 'serif_l', 24),
    ('引文　《淮南子》《尚书》《说文解字》《周礼》《诗经》《礼记》《论语》', 'serif_l', 22),
    ('音乐　Sacred Geometry　　画面　全片由代码生成', 'serif_l', 22),
]


def draw_credits(c, t, cue):
    rev, out = _env(t, cue['t0'], cue['t1'], 1.2, 2.2)
    if out <= 0:
        return
    draw_text(c, '圣显', W / 2, 360, size=86, face='serif_sb', col=PAL['pale'], alpha=out, reveal=rev,
              track=0.5, rise=0, blur_in=10, stagger=0.3, shadow=0.6, glow=0.3, glow_col=PAL['gold'])
    # small cinnabar seal
    sa = out * clamp((t - cue['t0'] - 0.8) / 0.6)
    if sa > 0:
        x, y, s = W / 2 + 160, 300, 46
        c.drawRect(skia.Rect.MakeXYWH(x, y, s, s), paint_fill(PAL['cinnabar'], sa * 0.9))
        f = font('serif_b', 34)
        cw = adv('serif_b', 34, '显')
        c.drawString('显', x + s / 2 - cw / 2, y + s * 0.82, f, paint_fill((0.98, 0.93, 0.85), sa))
    for i, (txt, face, size) in enumerate(CREDITS):
        r = clamp((t - cue['t0'] - 1.2 - i * 0.5) / 1.2)
        draw_text(c, txt, W / 2, 470 + i * 46, size=size, face=face, col=PAL['moon'], alpha=out * 0.78,
                  reveal=r, track=0.08, rise=4, blur_in=3, stagger=0.4, shadow=0.5)


DRAW = dict(main=draw_main, title=draw_title, quote=draw_quote, bigquote=draw_bigquote, credits=draw_credits)


def draw_cues(c, t):
    for cue in CUES:
        if cue['t0'] - 0.05 <= t <= cue['t1'] + 0.05:
            DRAW[cue['kind']](c, t, cue)
