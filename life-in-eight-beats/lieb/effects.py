"""Effects: costume puffs, onomatopoeia, sparkles, dizzy stars, Zzz, speed lines,
fast-forward OSD, the flashback flashes.  All timed from timeline cues."""
import math
import random

import cairo

from .anim import smooth, smoother, clamp
from .draw import hexc, INK, disc, poly, stroke_line, text_world
from .fonts import cjk_font
from .timeline import TL, W, H

OWN_VOICES = ('baby', 'office', 'oldman', 'oldman_fast', 'oldman_slow', 'baby_final')
_COUNTS = [q for q in TL.cues if q.kind in ('count', 'voice')]


def mouth_on_counts(p, t):
    """The hero moves his mouth when the voice is his own (baby, office worker, old man)."""
    best = 0.0
    for q in _COUNTS:
        dt = t - q.t
        if -0.03 <= dt < 0.5 and q.data.get('voice') in OWN_VOICES:
            ln = 0.28 if q.data.get('voice') != 'oldman_slow' else 0.5
            if q.data.get('voice') == 'baby_final':
                ln = 0.6
            env = math.sin(math.pi * clamp((dt + 0.03) / ln))
            best = max(best, env * (1.0 if q.data.get('voice') == 'baby_final' else 0.7))
    if best > p['mouthOpen']:
        p['mouthOpen'] = best


# ------------------------------------------------------------------ world space
def _puff(ctx, c, r0, u, small):
    rnd = random.Random(int(c[0] * 7 + c[1] * 3))
    n = 9 if not small else 7
    a = 1 - smooth((u - 0.45) / 0.55)
    grow = 0.55 + 0.75 * math.sin(min(u, 1) * math.pi * 0.5)
    for k in range(n):
        ang = k * 2 * math.pi / n + rnd.uniform(-0.2, 0.2)
        d = r0 * (0.55 + 0.35 * u) * rnd.uniform(0.8, 1.1)
        rr = r0 * rnd.uniform(0.38, 0.55) * grow
        q = (c[0] + math.cos(ang) * d, c[1] + math.sin(ang) * d * 1.15)
        ctx.new_path()
        ctx.arc(q[0], q[1], rr + 4, 0, 2 * math.pi)
        ctx.set_source_rgba(*INK, 0.85 * a)
        ctx.fill()
    for k in range(n):
        ang = k * 2 * math.pi / n + rnd.uniform(-0.2, 0.2)
        d = r0 * (0.55 + 0.35 * u) * rnd.uniform(0.8, 1.1)
        rr = r0 * rnd.uniform(0.38, 0.55) * grow
        q = (c[0] + math.cos(ang) * d, c[1] + math.sin(ang) * d * 1.15)
        ctx.new_path()
        ctx.arc(q[0], q[1], rr, 0, 2 * math.pi)
        ctx.set_source_rgba(1, 1, 1, a)
        ctx.fill()
    ctx.new_path()
    ctx.arc(c[0], c[1], r0 * 0.75 * grow, 0, 2 * math.pi)
    ctx.set_source_rgba(1, 1, 1, a)
    ctx.fill()


def _star(ctx, c, r, col, rot_=0.0, a=1.0):
    pts = []
    for k in range(10):
        rr = r if k % 2 == 0 else r * 0.45
        ang = math.pi / 2 + rot_ + k * math.pi / 5
        pts.append((c[0] + rr * math.cos(ang), c[1] + rr * math.sin(ang)))
    ctx.new_path()
    ctx.move_to(*pts[0])
    for q in pts[1:]:
        ctx.line_to(*q)
    ctx.close_path()
    ctx.set_source_rgba(*INK, a)
    ctx.set_line_width(5)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.stroke_preserve()
    ctx.set_source_rgba(*col, a)
    ctx.fill()


def _pop_scale(dt):
    if dt < 0:
        return 0.0
    if dt < 0.12:
        return 0.3 + 0.95 * smooth(dt / 0.12)
    return 1.25 - 0.25 * smooth((dt - 0.12) / 0.1)


def world_effects(ctx, t, rig, cam):
    pr = rig.pr
    body_c = ((rig.pelvis[0] + rig.chest[0]) / 2, (rig.pelvis[1] + rig.chest[1]) / 2 + pr['head_r'] * 0.6)
    size = pr['torso'] + pr['head_r'] * 2
    # costume puffs
    for q in TL.find('puff'):
        small = q.data.get('small', False)
        dur = 0.32 if small else 0.5
        dt = t - q.t + (0.06 if not small else 0.03)
        if 0 <= dt < dur:
            _puff(ctx, body_c, size * (0.55 if small else 0.72), dt / dur, small)
    # S2 twinkle sparkles at the hands
    for q in TL.find('sfx', 'twinkle'):
        dt = t - q.t
        if 0 <= dt < 0.45:
            a = 1 - dt / 0.45
            for wr in (rig.wrL, rig.wrR):
                for k in range(3):
                    ang = k * 2.1 + dt * 6
                    c = (wr[0] + math.cos(ang) * (25 + 50 * dt), wr[1] + 30 + math.sin(ang) * (25 + 50 * dt))
                    _star(ctx, c, 13 * a + 4, hexc('#FFE14D'), dt * 4, a)
    # S2 dizzy: stars circling the head
    S2 = TL.S['S2']
    if S2.t(12) <= t < S2.t(14.4):
        a = min(1.0, (t - S2.t(12)) / 0.2) * (1 - smooth((t - S2.t(14.1)) / 0.3))
        hc = rig.head
        r = pr['head_r']
        for k in range(4):
            ang = t * 5 + k * math.pi / 2
            c = (hc[0] + math.cos(ang) * r * 1.4, hc[1] + r * 1.05 + math.sin(ang) * r * 0.35)
            _star(ctx, c, 14, hexc('#FFE14D') if k % 2 else hexc('#FFFFFF'), t * 3, a)
    # S4 dozing: Zzz and sweat
    S4 = TL.S['S4']
    if S4.t(0.5) <= t < S4.t(4.0):
        hc = rig.head
        r = pr['head_r']
        u = (t - S4.t(0.5)) / (S4.t(4.0) - S4.t(0.5))
        for k in range(3):
            ph = (u * 2.2 + k * 0.33) % 1.0
            c = (hc[0] + r * (0.9 + ph * 1.2), hc[1] + r * (0.8 + ph * 1.6))
            text_world(ctx, 'Z', c, 26 + 18 * ph, col=hexc('#3B5BA5'), font='Sans', outline=(hexc('#FFFFFF'), 5))
        # sweat drop
        sd = (hc[0] - r * 0.95, hc[1] + r * 0.3 - 30 * ((t * 1.5) % 1.0))
        poly(ctx, [(sd[0], sd[1] + 16), (sd[0] - 8, sd[1] - 2), (sd[0] + 8, sd[1] - 2)], hexc('#9FD8FF'), ow=2)
        disc(ctx, (sd[0], sd[1] - 4), 8, hexc('#9FD8FF'), ow=2)
    if S4.t(4.0) <= t < S4.t(4.9):           # "!" over the head
        dt = t - S4.t(4.0)
        hc = rig.head
        r = pr['head_r']
        text_world(ctx, '!', (hc[0] + r * 0.2, hc[1] + r * 1.9), 90 * _pop_scale(dt), col=hexc('#E5232B'),
                   font='Sans', outline=(hexc('#FFFFFF'), 8))
    # S5 robot sparks on every servo hit
    for q in TL.find('sfx', 'servo'):
        dt = t - q.t
        if 0 <= dt < 0.16:
            a = 1 - dt / 0.16
            for jp in (rig.elL, rig.elR, rig.neck_top):
                for k in range(4):
                    ang = k * math.pi / 2 + 0.6
                    stroke_line(ctx, [(jp[0] + math.cos(ang) * 14, jp[1] + math.sin(ang) * 14),
                                      (jp[0] + math.cos(ang) * (26 + 40 * dt), jp[1] + math.sin(ang) * (26 + 40 * dt))],
                                3, hexc('#21E6FF'), outline=False, alpha=a)
    # S8 fast-forward: speed lines behind the kung-fu moves
    S8 = TL.S['S8']
    if S8.t(8) - 0.05 <= t < S8.t(11) + S8.beat_len(11):
        rnd = random.Random(int(t * 30))
        for k in range(14):
            y = rig.pelvis[1] + rnd.uniform(-200, 420)
            x = rig.pelvis[0] + rnd.uniform(-900, 900)
            stroke_line(ctx, [(x, y), (x + rnd.uniform(120, 300), y)], 3, (1, 1, 1), outline=False, alpha=0.7)
    # S8 wind: petals/leaves blowing across during the freeze
    if S8.t(13.3) <= t < TL.S['S9'].t(1):
        rnd = random.Random(42)
        for k in range(26):
            sp = rnd.uniform(500, 900)
            x0 = rnd.uniform(-1200, 1200)
            y0 = rnd.uniform(0, 700)
            tt = t - S8.t(13.3)
            x = rig.anchor[0] - 1100 + ((x0 + 1100 + tt * sp) % 2400)
            y = y0 + 40 * math.sin(tt * 3 + k)
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(tt * 5 + k)
            ctx.scale(1, 0.45)
            disc(ctx, (0, 0), 9, hexc('#F7C6D9') if k % 3 else hexc('#BFE3C0'), outline=False)
            ctx.restore()
        for k in range(5):
            y = rig.head[1] + (k - 2) * 60
            x = rig.anchor[0] - 600 + ((t * 1400 + k * 380) % 1300)
            stroke_line(ctx, [(x, y), (x + 160, y + 6)], 3, (1, 1, 1), outline=False, alpha=0.6)
    # onomatopoeia anchored to the body
    for q in TL.find('text'):
        dt = t - q.t
        if dt < 0 or dt > 0.75:
            continue
        pos = q.data.get('pos')
        if pos == 'right':
            continue                      # drawn in screen space
        sc = _pop_scale(dt)
        a = 1 - smooth((dt - 0.5) / 0.25)
        r = pr['head_r']
        if pos == 'neck':
            side = -1 if (TL.find('text', '咔').index(q) % 2) else 1
            c = (rig.neck_top[0] + side * r * 1.6, rig.neck_top[1] + r * 0.4)
            fs, col = 62, hexc('#FFFFFF')
        elif pos == 'hands':
            c = ((rig.wrL[0] + rig.wrR[0]) / 2, max(rig.wrL[1], rig.wrR[1]) + r * 1.3)
            fs, col = 78, hexc('#FFE14D')
        else:
            c = (rig.head[0] + r * 1.5, rig.head[1] + r * 0.9)
            fs, col = 60, hexc('#FFFFFF')
        ctx.push_group()
        text_world(ctx, q.name, c, fs * sc, col=col, outline=(INK, 10), rot_deg=-8)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(max(0.0, a))


# ------------------------------------------------------------------ screen space
def _osd(ctx, s, txt, a):
    ctx.save()
    ctx.select_font_face('Sans', cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(54 * s)
    ctx.move_to(1560 * s, 120 * s)
    ctx.text_path(txt)
    ctx.set_source_rgba(0, 0, 0, 0.5 * a)
    ctx.set_line_width(6 * s)
    ctx.stroke_preserve()
    ctx.set_source_rgba(1, 1, 1, a)
    ctx.fill()
    ctx.restore()


def screen_effects(ctx, t, s, rig, cam):
    # whistle "哔！" bursting in from the right edge
    for q in TL.find('text'):
        if q.data.get('pos') != 'right':
            continue
        dt = t - q.t
        if 0 <= dt < 0.7:
            sc = _pop_scale(dt)
            a = 1 - smooth((dt - 0.45) / 0.25)
            ctx.save()
            ctx.scale(s, s)
            ctx.translate(1600, 330)
            ctx.rotate(-0.12)
            ctx.scale(sc, sc)
            # burst
            pts = []
            for k in range(24):
                rr = 190 if k % 2 == 0 else 120
                ang = k * math.pi / 12
                pts.append((rr * math.cos(ang), rr * 0.7 * math.sin(ang)))
            ctx.new_path()
            ctx.move_to(*pts[0])
            for p_ in pts[1:]:
                ctx.line_to(*p_)
            ctx.close_path()
            ctx.set_source_rgba(*INK, a)
            ctx.set_line_width(10)
            ctx.stroke_preserve()
            ctx.set_source_rgba(*hexc('#FFE14D'), a)
            ctx.fill()
            ctx.select_font_face(cjk_font(), cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
            ctx.set_font_size(84)
            ext = ctx.text_extents(q.name)
            ctx.move_to(-ext.x_advance / 2, 30)
            ctx.text_path(q.name)
            ctx.set_source_rgba(*hexc('#E5232B'), a)
            ctx.fill()
            ctx.restore()
    # fast-forward OSD (VHS style) during the 2x tai chi, "▶ x1" after the cough
    S8 = TL.S['S8']
    t_ff0, t_ff1 = S8.t(8) - 0.02, S8.t(11) + S8.beat_len(11)
    if t_ff0 <= t < t_ff1:
        blink = 1.0 if (t * 4) % 1 < 0.7 else 0.35
        _osd(ctx, s, '▶▶ ×2', blink)
    if t_ff1 + 0.45 <= t < S8.t(12) + 0.6:
        _osd(ctx, s, '▶ ×1', 1 - smooth((t - S8.t(12) - 0.3) / 0.3))
    # S9: a white flash on every beat
    S9 = TL.S['S9']
    if S9.t0 - 0.05 <= t < S9.t1:
        b = S9.beat_at(t)
        f = b - math.floor(b)
        a = math.exp(-f * 9.0) * 0.55
        ctx.set_source_rgba(1, 1, 1, a)
        ctx.paint()
        # vignette
        g = cairo.RadialGradient(W * s / 2, H * s / 2, H * s * 0.35, W * s / 2, H * s / 2, H * s * 0.95)
        g.add_color_stop_rgba(0, 0, 0, 0, 0)
        g.add_color_stop_rgba(1, 0.12, 0.07, 0.02, 0.6)
        ctx.set_source(g)
        ctx.paint()
    # S9 -> S10: dead stop (a quick dip)
    if TL.t_stop <= t < TL.t_stop + 0.12:
        ctx.set_source_rgba(0, 0, 0, 0.25 * (1 - (t - TL.t_stop) / 0.12))
        ctx.paint()
    # fade from black at the very start, fade to black before the title
    if t < 0.35:
        ctx.set_source_rgba(0, 0, 0, 1 - smooth(t / 0.35))
        ctx.paint()
    if TL.t_black - 0.12 <= t < TL.t_black:
        ctx.set_source_rgba(0.04, 0.04, 0.05, smooth((t - TL.t_black + 0.12) / 0.12))
        ctx.paint()
