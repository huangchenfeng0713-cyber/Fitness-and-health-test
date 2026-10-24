"""Flat capsule-man renderer (pycairo).

The context handed to these functions is already in WORLD coordinates
(y up, ground at 0) — see scenes.camera_matrix().  Limbs and torso are thick
round-capped strokes with a dark outline pass, the head is a circle with two
dot eyes, eyebrows (the main acting tool) and a mouth.
"""
import math
import cairo

from .skeleton import add, sub, mul, rot, lerp, lerp2

INK = (0.16, 0.15, 0.21)
SKIN = (0.97, 0.80, 0.66)


def hexc(s, a=None):
    s = s.lstrip('#')
    c = tuple(int(s[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return c if a is None else c + (a,)


def mixc(a, b, u):
    return tuple(a[i] + (b[i] - a[i]) * u for i in range(3))


# ------------------------------------------------------------------ costumes
COSTUMES = {
    'baby':   dict(top='#FFE08A', sleeve='#FFE08A', long=True, pants='#FFE08A', shorts=False,
                   shoes='#FFE08A', hair='curl', haircol='#6B4A2E', deco='onesie'),
    'kid':    dict(top='#79C3E8', sleeve='#79C3E8', long=False, pants='#355C8C', shorts=True,
                   shoes='#E8484F', hair='bowl', haircol='#3B2A20', deco='flower'),
    'school': dict(top='#F7F7F2', sleeve='#2F5DAE', long=True, pants='#2F5DAE', shorts=False,
                   shoes='#FFFFFF', hair='neat', haircol='#2D211B', deco='scarf'),
    'army':   dict(top='#5E7444', sleeve='#5E7444', long=True, pants='#5E7444', shorts=False,
                   shoes='#26241F', hair='cap', haircol='#2D211B', deco='camo'),
    'teen':   dict(top='#FFC21A', sleeve='#FFC21A', long=True, pants='#25344F', shorts=False,
                   shoes='#F2F2F2', hair='messy', haircol='#231A16', deco='hoodie'),
    'office': dict(top='#F2F5F8', sleeve='#F2F5F8', long=True, pants='#3A3F4B', shorts=False,
                   shoes='#1E1E22', hair='office', haircol='#2A221D', deco='tie'),
    'plaza':  dict(top='#E8436B', sleeve='#E8436B', long=True, pants='#2A2730', shorts=False,
                   shoes='#2A2730', hair='comb', haircol='#3A3029', deco='fan'),
    'old':    dict(top='#F4F2EA', sleeve='#F4F2EA', long=True, pants='#F4F2EA', shorts=False,
                   shoes='#222222', hair='white', haircol='#FFFFFF', deco='taichi'),
    # crowd variants
    'pupil':  dict(top='#F7F7F2', sleeve='#2F5DAE', long=True, pants='#2F5DAE', shorts=False,
                   shoes='#FFFFFF', hair='neat', haircol='#2D211B', deco='scarf'),
    'auntie': dict(top='#B44FC9', sleeve='#B44FC9', long=True, pants='#1F1C25', shorts=False,
                   shoes='#1F1C25', hair='perm', haircol='#2B1E1E', deco='fan'),
}
for _c in COSTUMES.values():
    for _k in ('top', 'sleeve', 'pants', 'shoes', 'haircol'):
        _c[_k] = hexc(_c[_k])


# ------------------------------------------------------------------ primitives
def stroke_line(ctx, pts, w, col, outline=True, ow=None, alpha=1.0):
    if ow is None:
        ow = max(2.5, w * 0.13)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    if outline:
        ctx.new_path()
        ctx.move_to(*pts[0])
        for q in pts[1:]:
            ctx.line_to(*q)
        ctx.set_source_rgba(*INK, alpha)
        ctx.set_line_width(w + 2 * ow)
        ctx.stroke()
    ctx.new_path()
    ctx.move_to(*pts[0])
    for q in pts[1:]:
        ctx.line_to(*q)
    ctx.set_source_rgba(*col[:3], alpha)
    ctx.set_line_width(w)
    ctx.stroke()


def stroke_curve(ctx, p0, c, p1, w, col, outline=True, ow=None):
    if ow is None:
        ow = max(2.5, w * 0.13)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for pass_ in ((INK, w + 2 * ow), (col, w)) if outline else ((col, w),):
        ctx.new_path()
        ctx.move_to(*p0)
        # quadratic -> cubic
        c1 = lerp2(p0, c, 2 / 3)
        c2 = lerp2(p1, c, 2 / 3)
        ctx.curve_to(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1])
        ctx.set_source_rgb(*pass_[0][:3])
        ctx.set_line_width(pass_[1])
        ctx.stroke()


def disc(ctx, c, r, col, outline=True, ow=3.0):
    if outline:
        ctx.new_path()
        ctx.arc(c[0], c[1], r + ow, 0, 2 * math.pi)
        ctx.set_source_rgb(*INK)
        ctx.fill()
    ctx.new_path()
    ctx.arc(c[0], c[1], r, 0, 2 * math.pi)
    ctx.set_source_rgb(*col[:3])
    ctx.fill()


def poly(ctx, pts, col, outline=True, ow=3.0, close=True):
    ctx.new_path()
    ctx.move_to(*pts[0])
    for q in pts[1:]:
        ctx.line_to(*q)
    if close:
        ctx.close_path()
    if outline:
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(2 * ow)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke_preserve()
    ctx.set_source_rgb(*col[:3])
    ctx.fill()


def text_world(ctx, s, at, size, col=INK, font=None, align=0.5, rot_deg=0.0, outline=None):
    """Upright text at a world position (the world context is y-up)."""
    from .fonts import cjk_font
    ctx.save()
    ctx.translate(*at)
    ctx.scale(1, -1)
    ctx.rotate(math.radians(-rot_deg))
    ctx.select_font_face(font or cjk_font(), cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    ctx.set_font_size(size)
    ext = ctx.text_extents(s)
    x = -ext.x_advance * align
    y = -(ext.y_bearing + ext.height / 2)
    ctx.move_to(x, y)
    ctx.text_path(s)
    if outline:
        ctx.set_source_rgb(*outline[0])
        ctx.set_line_width(outline[1])
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.stroke_preserve()
    ctx.set_source_rgb(*col[:3])
    ctx.fill()
    ctx.restore()


# ------------------------------------------------------------------ the character
class Look:
    """What the character is wearing at a given moment, plus secondary-motion state."""

    def __init__(self, costume, sec=None, fans=0.0, props_extra=None, alpha=1.0, tint=None):
        self.c = COSTUMES[costume] if isinstance(costume, str) else costume
        self.name = costume if isinstance(costume, str) else 'custom'
        self.sec = sec or {}
        self.fans = fans
        self.alpha = alpha
        self.tint = tint


def _limb_cols(c):
    upper = c['sleeve']
    lower = c['sleeve'] if c['long'] else SKIN
    thigh = c['pants']
    shin = c['pants'] if not c['shorts'] else SKIN
    return upper, lower, thigh, shin


def draw_character(ctx, rig, look, t=0.0):
    pr, p, c = rig.pr, rig.pose, look.c
    sec = look.sec
    lw = pr['limb_w']
    ow = max(2.6, lw * 0.14)
    upper, lower, thigh, shin = _limb_cols(c)
    back_view = rig.scale_x < -0.05
    deco = c['deco']

    # ---------------- legs
    for side in ('L', 'R'):
        hip, kn, an, toe = (rig.hipL, rig.knL, rig.anL, rig.toeL) if side == 'L' else (rig.hipR, rig.knR, rig.anR, rig.toeR)
        loose = 1.22 if deco == 'taichi' else 1.0
        stroke_line(ctx, [hip, kn], lw * 1.04 * loose, thigh, ow=ow)
        stroke_line(ctx, [kn, an], lw * loose, shin, ow=ow)
        if c['shorts']:     # trouser hem
            stroke_line(ctx, [lerp2(hip, kn, 0.55), kn], lw * 1.22, thigh, ow=ow)
        stroke_line(ctx, [an, toe], lw * 0.98, c['shoes'], ow=ow)

    # ---------------- torso
    tw = pr['torso_w']
    pel, ch = rig.pelvis, rig.chest
    hunch = pr['hunch']
    face = p['face']
    fdir = 1 if face >= 0 else -1
    mid = lerp2(pel, ch, 0.55)
    tdir = sub(ch, pel)
    # hunch bulges the back, i.e. away from the side the character faces
    ctrl = add(mid, (hunch * 1.4 * -fdir * min(1, abs(face) + 0.4) * rig.scale_x, 0))
    bottom = add(pel, mul(tdir, -0.06))
    belly = None
    if pr['belly'] > 1:
        bj = sec.get('belly', 0.0)
        bc = add(lerp2(pel, ch, 0.32), (fdir * min(1.0, abs(face) * 1.3) * pr['belly'] * 0.55 * rig.scale_x, bj))
        belly = (bc, pr['belly'] * 0.5 + tw * 0.36)
    # outline pass for torso + belly, then fill pass: one merged silhouette
    stroke_curve(ctx, bottom, ctrl, ch, tw + 2 * ow, INK, outline=False)
    if belly:
        disc(ctx, belly[0], belly[1] + ow, INK, outline=False)
    stroke_curve(ctx, bottom, ctrl, ch, tw, c['top'], outline=False)
    if belly:
        disc(ctx, belly[0], belly[1], c['top'], outline=False)
        ctx.new_path()
        bcx, bcy = belly[0]
        ctx.arc(bcx, bcy - belly[1] * 0.15, belly[1] * 0.75, math.pi * 1.2, math.pi * 1.8)
        ctx.set_source_rgba(*INK, 0.22)
        ctx.set_line_width(2.5)
        ctx.stroke()
    if deco == 'onesie':   # the onesie seat
        disc(ctx, add(pel, mul(tdir, 0.05)), tw * 0.42, c['top'], outline=False)

    _torso_deco(ctx, rig, look, t, tw, ow)
    stroke_line(ctx, [ch, rig.neck_top], lw * 0.9, SKIN, ow=ow)
    if deco == 'teen':   # hood lump behind the neck
        disc(ctx, add(ch, mul(sub(rig.neck_top, ch), 0.2)), tw * 0.45, c['top'], ow=ow)
    if deco == 'scarf':
        _scarf(ctx, rig, look, ow)
    if deco == 'tie':
        _tie(ctx, rig, look, ow)

    # ---------------- arms (in front of the torso, behind the head)
    for side in ('L', 'R'):
        sh, el, wr, hang = (rig.shL, rig.elL, rig.wrL, rig.hand_angL) if side == 'L' else (rig.shR, rig.elR, rig.wrR, rig.hand_angR)
        loose = 1.2 if deco == 'taichi' else 1.0
        stroke_line(ctx, [sh, el], lw * loose, upper, ow=ow)
        stroke_line(ctx, [el, wr], lw * 0.95 * loose, lower, ow=ow)
        if deco == 'camo':
            _camo_spots(ctx, [sh, el, wr], lw * 0.4, side)
        hand = p['hand' + side]
        fan_w = min(1.15, p['fan'])
        if deco == 'fan' and fan_w > 0.01:
            _fan(ctx, wr, hang + sec.get('fan' + side, 0.0), lw, fan_w, ow)
        _hand(ctx, wr, hang, lw, hand, ow)

    # ---------------- head
    _head(ctx, rig, look, t, ow, back_view)


def _hand(ctx, wr, ang, lw, hand, ow):
    r = lw * 0.62
    if hand > 0.5:
        # open twinkle hand: five short fingers fanned around the forearm direction
        d = (math.sin(math.radians(ang)), -math.cos(math.radians(ang)))
        for k in range(5):
            a = ang + (k - 2) * 28
            dd = (math.sin(math.radians(a)), -math.cos(math.radians(a)))
            tip = add(wr, mul(dd, r * 1.9))
            stroke_line(ctx, [add(wr, mul(d, r * 0.3)), tip], lw * 0.34, SKIN, ow=ow * 0.8)
    disc(ctx, wr, r, SKIN, ow=ow)


def _camo_spots(ctx, pts, r, seed):
    cols = [hexc('#3E4F2C'), hexc('#8D9A5E'), hexc('#2F3A22')]
    for i in range(len(pts) - 1):
        for k, u in enumerate((0.3, 0.7)):
            q = lerp2(pts[i], pts[i + 1], u)
            ctx.new_path()
            ctx.arc(q[0] + (k - 0.5) * r * 0.5, q[1], r * 0.55, 0, 2 * math.pi)
            ctx.set_source_rgb(*cols[(i + k + (seed == 'L')) % 3])
            ctx.fill()


def _torso_deco(ctx, rig, look, t, tw, ow):
    c = look.c
    deco = c['deco']
    pel, ch = rig.pelvis, rig.chest
    tdir = sub(ch, pel)
    side = (rig.scale_x * 1.0, 0)
    if deco == 'onesie':
        for k in range(3):
            q = lerp2(pel, ch, 0.35 + 0.17 * k)
            disc(ctx, q, 3.2, hexc('#E7A93B'), outline=False)
        # round collar
        ctx.new_path()
        ctx.arc(ch[0], ch[1], tw * 0.32, math.pi * 1.1, math.pi * 1.9)
        ctx.set_source_rgb(*hexc('#FFFFFF'))
        ctx.set_line_width(5)
        ctx.stroke()
    elif deco == 'flower':
        q = lerp2(pel, ch, 0.72)
        q = add(q, (tw * 0.18 * rig.scale_x, 0))
        r = tw * 0.2
        for k in range(6):
            a = k * math.pi / 3 + 0.3
            disc(ctx, add(q, (math.cos(a) * r, math.sin(a) * r)), r * 0.72, hexc('#E8323C'), ow=2)
        disc(ctx, q, r * 0.55, hexc('#FFD23F'), ow=2)
        # ribbon
        stroke_line(ctx, [add(q, (-r * 0.4, -r)), add(q, (-r * 0.8, -r * 2.4))], 5, hexc('#E8323C'), ow=2)
        stroke_line(ctx, [add(q, (r * 0.4, -r)), add(q, (r * 0.7, -r * 2.4))], 5, hexc('#E8323C'), ow=2)
    elif deco == 'camo':
        for k, u in enumerate((0.15, 0.45, 0.75)):
            q = lerp2(pel, ch, u)
            for j in (-1, 1):
                ctx.new_path()
                ctx.arc(q[0] + j * tw * 0.18 + k * 3, q[1] + j * 4, tw * 0.17, 0, 2 * math.pi)
                ctx.set_source_rgb(*hexc(['#3E4F2C', '#8D9A5E', '#2F3A22'][(k + j) % 3]))
                ctx.fill()
        # belt
        b = lerp2(pel, ch, 0.08)
        stroke_line(ctx, [add(b, (-tw * 0.45, 0)), add(b, (tw * 0.45, 0))], 8, hexc('#2A2A22'), outline=False)
    elif deco == 'teen':
        # kangaroo pocket + drawstrings (springs)
        q = lerp2(pel, ch, 0.28)
        stroke_line(ctx, [add(q, (-tw * 0.26, 0)), add(q, (tw * 0.26, 0))], tw * 0.28, hexc('#F0A800'), outline=False)
        for j, key in ((-1, 'strL'), (1, 'strR')):
            a = add(ch, (j * tw * 0.16, -tw * 0.12))
            off = look.sec.get(key, (0, -tw * 0.9))
            stroke_line(ctx, [a, add(a, off)], 4, hexc('#FFFFFF'), ow=1.5)
    elif deco == 'tie':
        # collar wings
        for j in (-1, 1):
            poly(ctx, [add(ch, (0, -6)), add(ch, (j * tw * 0.36, -2)), add(ch, (j * tw * 0.16, -tw * 0.32))],
                 hexc('#FFFFFF'), ow=2)
        # badge on its lanyard (spring)
        a = add(ch, (tw * 0.18 * rig.scale_x, -tw * 0.1))
        off = look.sec.get('badge', (tw * 0.08, -tw * 1.3))
        b = add(a, off)
        stroke_line(ctx, [add(ch, (-tw * 0.2, -4)), b], 3, hexc('#2D7DD2'), outline=False)
        stroke_line(ctx, [add(ch, (tw * 0.25, -4)), b], 3, hexc('#2D7DD2'), outline=False)
        ctx.save()
        ctx.translate(*b)
        ang = math.atan2(off[0], -off[1])
        ctx.rotate(ang * 0.6)
        poly(ctx, [(-13, 0), (13, 0), (13, -32), (-13, -32)], hexc('#FFFFFF'), ow=2)
        poly(ctx, [(-13, -4), (13, -4), (13, -11), (-13, -11)], hexc('#2D7DD2'), outline=False)
        disc(ctx, (0, -21), 5, hexc('#B9C4D0'), outline=False)
        ctx.restore()
    elif deco == 'fan':
        # floral dots on the top
        for k, (u, dx) in enumerate(((0.25, -0.2), (0.5, 0.15), (0.75, -0.1), (0.4, 0.3), (0.62, -0.32))):
            q = add(lerp2(pel, ch, u), (dx * tw, 0))
            for a in range(5):
                aa = a * 2 * math.pi / 5 + k
                disc(ctx, add(q, (math.cos(aa) * 4.5, math.sin(aa) * 4.5)), 3.4, hexc('#FFD6E0'), outline=False)
            disc(ctx, q, 2.6, hexc('#FFE16A'), outline=False)
    elif deco == 'taichi':
        # frog buttons down the front + a dark sash
        for k in range(4):
            q = lerp2(pel, ch, 0.3 + 0.17 * k)
            q = add(q, (tw * 0.1 * rig.scale_x * (1 if rig.pose['face'] >= 0 else -1), 0))
            stroke_line(ctx, [add(q, (-7, 0)), add(q, (7, 0))], 4, hexc('#3C3A36'), outline=False)
            disc(ctx, q, 3.2, hexc('#3C3A36'), outline=False)
        b = lerp2(pel, ch, 0.12)
        stroke_line(ctx, [add(b, (-tw * 0.46, 0)), add(b, (tw * 0.46, 0))], 9, hexc('#3C3A36'), outline=False)


def _scarf(ctx, rig, look, ow):
    tw = rig.pr['torso_w']
    ch = rig.chest
    red = hexc('#E5232B')
    knot = add(ch, (0, -tw * 0.08))
    # collar triangle around the neck
    poly(ctx, [add(ch, (-tw * 0.42, tw * 0.02)), add(ch, (tw * 0.42, tw * 0.02)), add(knot, (0, -tw * 0.1))], red, ow=2)
    for key, j in (('scarfL', -1), ('scarfR', 1)):
        off = look.sec.get(key, (j * tw * 0.1, -tw * 0.85))
        tip = add(knot, off)
        a = add(knot, (j * 4, 0))
        nrm = (-off[1], off[0])
        n = math.hypot(*nrm) or 1
        nrm = mul(nrm, 1 / n)
        w0 = tw * 0.13
        poly(ctx, [add(a, mul(nrm, w0)), add(tip, mul(nrm, w0 * 0.5)), add(tip, mul(nrm, -w0 * 0.9)), add(a, mul(nrm, -w0))], red, ow=2)
    disc(ctx, knot, tw * 0.11, red, ow=2)


def _tie(ctx, rig, look, ow):
    tw = rig.pr['torso_w']
    ch = rig.chest
    col = hexc('#C0392B')
    knot = add(ch, (0, -tw * 0.18))
    off = look.sec.get('tie', (0, -tw * 1.6))
    tip = add(knot, off)
    n = math.hypot(*off) or 1
    nrm = (-off[1] / n, off[0] / n)
    w = tw * 0.13
    poly(ctx, [add(knot, mul(nrm, w * 0.6)), add(lerp2(knot, tip, 0.88), mul(nrm, w)), tip,
               add(lerp2(knot, tip, 0.88), mul(nrm, -w)), add(knot, mul(nrm, -w * 0.6))], col, ow=2)
    for k in range(3):   # stripes
        u = 0.3 + 0.2 * k
        a = add(lerp2(knot, tip, u), mul(nrm, w * 0.8))
        b = add(lerp2(knot, tip, u + 0.08), mul(nrm, -w * 0.8))
        stroke_line(ctx, [a, b], 3, hexc('#8E1F14'), outline=False)
    poly(ctx, [add(knot, (-w * 0.9, w * 0.7)), add(knot, (w * 0.9, w * 0.7)), add(knot, (w * 0.5, -w * 0.6)), add(knot, (-w * 0.5, -w * 0.6))], col, ow=2)


def _fan(ctx, wr, ang, lw, amount, ow):
    """Red folding fan held at the wrist, opening with `amount` (0..1)."""
    R = lw * 3.3 * (0.35 + 0.65 * amount)
    spread = math.radians(62 * amount + 4)
    base = math.radians(ang) - math.pi / 2   # direction the forearm points, in cairo angle terms
    ctx.save()
    ctx.translate(*wr)
    ctx.new_path()
    ctx.move_to(0, 0)
    ctx.arc(0, 0, R + ow, base - spread - 0.03, base + spread + 0.03)
    ctx.close_path()
    ctx.set_source_rgb(*INK)
    ctx.fill()
    ctx.new_path()
    ctx.move_to(0, 0)
    ctx.arc(0, 0, R, base - spread, base + spread)
    ctx.close_path()
    ctx.set_source_rgb(*hexc('#E3262E'))
    ctx.fill()
    # inner paper band + gold rim + ribs
    ctx.new_path()
    ctx.arc(0, 0, R * 0.93, base - spread, base + spread)
    ctx.set_source_rgb(*hexc('#FFC93C'))
    ctx.set_line_width(R * 0.07)
    ctx.stroke()
    for k in range(9):
        a = base - spread + 2 * spread * k / 8
        ctx.new_path()
        ctx.move_to(0, 0)
        ctx.line_to(math.cos(a) * R * 0.9, math.sin(a) * R * 0.9)
        ctx.set_source_rgba(*hexc('#9B1018'), 0.6)
        ctx.set_line_width(1.6)
        ctx.stroke()
    ctx.restore()


# ------------------------------------------------------------------ head, hair, face
def _head(ctx, rig, look, t, ow, back_view):
    pr, p, c = rig.pr, rig.pose, look.c
    r = pr['head_r']
    hc = rig.head
    ctx.save()
    ctx.translate(*hc)
    ctx.rotate(math.radians(rig.head_ang))
    hair = c['hair']
    hcol = c['haircol']
    sx = rig.scale_x
    # facing offset of the features (-1..1); spinning slides them across the head
    spin = math.radians(p['spin'])
    fo = max(-1.0, min(1.0, p['face'] * abs(math.cos(spin)) + math.sin(spin) * 0.9)) if abs(p['spin']) > 0.01 else p['face']
    face_vis = max(0.0, min(1.0, (math.cos(spin) - 0.05) / 0.25)) if abs(p['spin']) > 0.01 else 1.0

    _hair_back(ctx, hair, hcol, r, fo, look, ow)
    disc(ctx, (0, 0), r, SKIN, ow=ow)
    if face_vis < 0.999:
        # back of the head: hair covers it
        _hair_cover(ctx, hair, hcol, r, 1 - face_vis)
    if face_vis > 0.01:
        ctx.save()
        ctx.rotate(math.radians(p['facerot']))
        _face(ctx, p, r, fo, face_vis, look, t)
        ctx.restore()
    _hair_front(ctx, hair, hcol, r, fo, look, ow, t)
    ctx.restore()


def _hair_back(ctx, hair, col, r, fo, look, ow):
    if hair == 'perm':
        for k in range(9):
            a = math.pi * (0.0 + k / 8.0)
            disc(ctx, (math.cos(a) * r * 0.95, math.sin(a) * r * 0.85 + r * 0.1), r * 0.36, col, ow=ow)
    if hair == 'white':
        sec = look.sec
        white = hexc('#FFFFFF')
        for key, j in (('hairL', -1), ('hairR', 1)):
            root = (j * r * 0.9, r * 0.12)
            off = sec.get(key, (j * r * 0.45, -r * 0.15))
            tip = add(root, off)
            n = math.hypot(*off) or 1
            nrm = (-off[1] / n, off[0] / n)
            w = r * 0.2
            pts = [add(root, mul(nrm, w)), add(lerp2(root, tip, 0.55), mul(nrm, w * 0.8)), tip,
                   add(lerp2(root, tip, 0.5), mul(nrm, -w * 0.7)), add(root, mul(nrm, -w))]
            poly(ctx, pts, white, ow=2.2)
            disc(ctx, root, r * 0.21, white, ow=2.2)


def _hair_cover(ctx, hair, col, r, amt):
    if hair in ('white', 'cap'):
        return
    ctx.new_path()
    ctx.arc(0, 0, r * 0.98, 0, 2 * math.pi)
    ctx.set_source_rgba(*col, min(1.0, amt * 1.2) * (0.95 if hair != 'curl' else 0.25))
    ctx.fill()


def _hair_front(ctx, hair, col, r, fo, look, ow, t):
    sh = fo * r * 0.15
    if hair == 'curl':
        ctx.new_path()
        ctx.move_to(0, r * 0.92)
        ctx.curve_to(r * 0.05, r * 1.35, r * 0.45, r * 1.3, r * 0.32, r * 1.08)
        ctx.curve_to(r * 0.22, r * 0.95, r * 0.1, r * 1.12, r * 0.22, r * 1.18)
        ctx.set_source_rgb(*col)
        ctx.set_line_width(r * 0.09)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
    elif hair in ('bowl', 'neat', 'office', 'messy'):
        lo = {'bowl': 0.18, 'neat': 0.42, 'office': 0.5, 'messy': 0.3}[hair]
        a0 = math.asin(lo)
        ctx.new_path()
        ctx.arc(0, 0, r * 1.04, a0 - 0.05, math.pi - a0 + 0.05)
        if hair == 'bowl':
            ctx.line_to(-r * 0.98, r * lo)
            ctx.line_to(r * 0.98, r * lo)
        elif hair == 'messy':
            n = 6
            for k in range(n + 1):
                x = -r * 0.95 + 1.9 * r * k / n + sh
                y = r * (lo - 0.12) if k % 2 else r * (lo + 0.18)
                ctx.line_to(x, y)
        else:
            # side part
            ctx.line_to(-r * 0.92, r * lo)
            ctx.curve_to(-r * 0.3 + sh, r * (lo + 0.05), r * 0.1 + sh, r * (lo + 0.35), r * 0.25 + sh, r * 0.95)
            ctx.curve_to(r * 0.5 + sh, r * (lo + 0.15), r * 0.8, r * lo, r * 0.96, r * lo)
        ctx.close_path()
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(ow * 2)
        ctx.stroke_preserve()
        ctx.set_source_rgb(*col)
        ctx.fill()
        if hair == 'messy':      # headphones
            ctx.new_path()
            ctx.arc(0, 0, r * 1.12, math.radians(15), math.radians(165))
            ctx.set_source_rgb(*INK)
            ctx.set_line_width(r * 0.2)
            ctx.stroke()
            ctx.new_path()
            ctx.arc(0, 0, r * 1.12, math.radians(15), math.radians(165))
            ctx.set_source_rgb(*hexc('#E8364F'))
            ctx.set_line_width(r * 0.11)
            ctx.stroke()
            for j in (-1, 1):
                x = j * r * 1.0
                ctx.save()
                ctx.translate(x - fo * r * 0.1 * j, r * 0.12)
                ctx.scale(0.62, 1)
                disc(ctx, (0, 0), r * 0.36, hexc('#2B2B33'), ow=ow * 1.2)
                disc(ctx, (0, 0), r * 0.2, hexc('#E8364F'), outline=False)
                ctx.restore()
    elif hair == 'cap':
        # camo field cap with a brim on the facing side
        ctx.new_path()
        ctx.arc(0, r * 0.1, r * 1.06, math.radians(10), math.radians(170))
        ctx.close_path()
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(ow * 2)
        ctx.stroke_preserve()
        ctx.set_source_rgb(*hexc('#5E7444'))
        ctx.fill()
        for k, (x, y) in enumerate(((-0.4, 0.6), (0.2, 0.75), (0.5, 0.4), (-0.1, 0.38))):
            disc(ctx, (x * r, y * r), r * 0.14, hexc(['#3E4F2C', '#8D9A5E'][k % 2]), outline=False)
        bd = 1 if fo >= 0 else -1
        bw = 0.5 + 0.5 * abs(fo)
        stroke_line(ctx, [(fo * r * 0.2 - r * 0.85 * (1 - abs(fo)), r * 0.28), (fo * r * 0.2 + r * (0.85 + 0.45 * abs(fo)) * bd if abs(fo) > 0.2 else r * 0.85, r * 0.28)],
                    r * 0.14, hexc('#4A5C35'), ow=2.5)
        disc(ctx, (fo * r * 0.4, r * 0.62), r * 0.11, hexc('#E5232B'), ow=2)   # red star badge
    elif hair == 'comb':
        # thinning comb-over: side hair + three brave strands
        for j in (-1, 1):
            ctx.new_path()
            ctx.arc(0, 0, r * 1.03, math.pi / 2 - j * math.radians(80) - math.radians(18), math.pi / 2 - j * math.radians(80) + math.radians(18))
            ctx.set_source_rgb(*col)
            ctx.set_line_width(r * 0.2)
            ctx.stroke()
        for k in range(3):
            ctx.new_path()
            y = r * (0.72 + 0.09 * k)
            ctx.move_to(-r * 0.8, y - r * 0.2)
            ctx.curve_to(-r * 0.3, y + r * 0.25, r * 0.4, y + r * 0.2, r * 0.82, y - r * 0.25)
            ctx.set_source_rgb(*col)
            ctx.set_line_width(3.5)
            ctx.stroke()
    elif hair == 'perm':
        for k in range(7):
            a = math.pi * (0.12 + 0.76 * k / 6)
            disc(ctx, (math.cos(a) * r * 0.82, math.sin(a) * r * 0.82), r * 0.27, col, outline=False)
    elif hair == 'white':
        # one brave wisp on top of the bald head, and a little goatee
        sec = look.sec
        off = sec.get('hairT', (r * 0.12, r * 0.42))
        a = (fo * r * -0.1, r * 0.97)
        ctx.new_path()
        ctx.move_to(*a)
        ctx.curve_to(a[0] + off[0] * 0.1, a[1] + off[1] * 0.6, a[0] + off[0] * 0.8, a[1] + off[1] * 0.9, a[0] + off[0], a[1] + off[1])
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(5.5)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke_preserve()
        ctx.set_source_rgb(1, 1, 1)
        ctx.set_line_width(3)
        ctx.stroke()
        boff = sec.get('beard', (0, -r * 0.42))
        b0 = (fo * r * 0.4, -r * 0.62)
        n = math.hypot(*boff) or 1
        nrm = (-boff[1] / n, boff[0] / n)
        w = r * 0.18
        poly(ctx, [add(b0, mul(nrm, w)), add(b0, boff), add(b0, mul(nrm, -w))], hexc('#FFFFFF'), ow=2.2)


def _face(ctx, p, r, fo, vis, look, t):
    ctx.save()
    ex = r * 0.34 * (1 - 0.45 * abs(fo))
    cx = fo * r * 0.42
    ey = r * 0.02
    big = 1.0 + 0.35 * max(0.0, p['brow'] - 0.6)
    er = r * 0.085 * big
    alpha = vis
    # eyes
    for j in (-1, 1):
        x = cx + j * ex
        if p['dizzy'] > 0.5:
            ctx.new_path()
            for k in range(60):
                a = k / 59 * 4 * math.pi + t * 9 * j
                rr = r * 0.16 * k / 59
                px, py = x + math.cos(a) * rr, ey + math.sin(a) * rr
                (ctx.move_to if k == 0 else ctx.line_to)(px, py)
            ctx.set_source_rgba(*INK, alpha)
            ctx.set_line_width(2.6)
            ctx.stroke()
        elif p['eye'] < 0.35:
            ctx.new_path()
            ctx.move_to(x - er * 1.4, ey)
            ctx.line_to(x + er * 1.4, ey)
            ctx.set_source_rgba(*INK, alpha)
            ctx.set_line_width(3.2)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.stroke()
        else:
            ctx.save()
            ctx.translate(x, ey)
            ctx.scale(1, max(0.2, min(1.0, p['eye'])))
            ctx.new_path()
            ctx.arc(0, 0, er, 0, 2 * math.pi)
            ctx.set_source_rgba(*INK, alpha)
            ctx.fill()
            ctx.restore()
            if look.c['hair'] == 'white':   # half-lidded old eyes
                ctx.new_path()
                ctx.move_to(x - er * 1.5, ey + er * 0.35)
                ctx.line_to(x + er * 1.5, ey + er * 0.35)
                ctx.set_source_rgba(*SKIN, alpha)
                ctx.set_line_width(er * 0.9)
                ctx.stroke()
    # eyebrows: the main acting tool.  browTilt>0 = inner ends down (stern, very serious)
    by = r * 0.3 + p['brow'] * r * 0.12
    bl = r * 0.17
    white = look.c['hair'] == 'white'
    for j in (-1, 1):
        x = cx + j * ex
        inner_low = p['browTilt'] * bl * 0.55      # inner end (towards the nose) lower = stern
        if j < 0:
            a, b = (x - bl, by + inner_low * 0.5), (x + bl, by - inner_low * 0.5)
        else:
            a, b = (x - bl, by - inner_low * 0.5), (x + bl, by + inner_low * 0.5)
        if white:   # bushy white old-man brows, drooping at the outer end
            outer = (b if j > 0 else a)
            droop = (outer[0] + j * bl * 0.35, outer[1] - bl * 0.55)
            for col, wdt in ((INK, r * 0.15 + 3.5), ((1, 1, 1), r * 0.15)):
                ctx.new_path()
                if j > 0:
                    ctx.move_to(*a); ctx.line_to(*b); ctx.line_to(*droop)
                else:
                    ctx.move_to(*b); ctx.line_to(*a); ctx.line_to(*droop)
                ctx.set_source_rgba(*col[:3], alpha)
                ctx.set_line_width(wdt)
                ctx.set_line_cap(cairo.LINE_CAP_ROUND)
                ctx.set_line_join(cairo.LINE_JOIN_ROUND)
                ctx.stroke()
        else:
            ctx.new_path()
            ctx.move_to(*a)
            ctx.line_to(*b)
            ctx.set_source_rgba(*INK, alpha)
            ctx.set_line_width(r * 0.1)
            ctx.set_line_cap(cairo.LINE_CAP_ROUND)
            ctx.stroke()
    # mouth
    my = -r * 0.38
    mw = r * 0.16
    mx = cx * 0.9
    if p['mouthOpen'] > 0.08:
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(1, 0.4 + 0.9 * p['mouthOpen'])
        ctx.new_path()
        ctx.arc(0, 0, mw * 0.85, 0, 2 * math.pi)
        ctx.set_source_rgba(*INK, alpha)
        ctx.fill()
        ctx.restore()
    else:
        ctx.new_path()
        ctx.move_to(mx - mw, my)
        ctx.curve_to(mx - mw * 0.3, my - p['mouth'] * r * 0.12, mx + mw * 0.3, my - p['mouth'] * r * 0.12, mx + mw, my)
        ctx.set_source_rgba(*INK, alpha)
        ctx.set_line_width(r * 0.07)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
    ctx.restore()
