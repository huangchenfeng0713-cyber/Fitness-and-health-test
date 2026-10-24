"""2D capsule-man skeleton.

Pose  = root (anchor x, pelvis offset, body rotation) + joint angles.
Arms, spine, neck, head: forward kinematics.
Legs: two-bone inverse kinematics to a foot target.  A "planted" foot target
lives in world/ground coordinates, so a planted foot cannot slide no matter
what the pelvis does; the pelvis is lowered automatically when a planted
foot would be out of reach (bent knees instead of a hovering foot).

Coordinates: world units are 1080p pixels, y points UP, ground is y = 0.
Angles: degrees, counter-clockwise positive.  Arm angles are measured from
"hanging straight down" in the body frame.
"""
import math
from dataclasses import dataclass

# ---------------------------------------------------------------- proportions
# Absolute sizes (px at camera zoom 1).  Ratios give ~1:3 (baby) .. ~1:6 (adult).
PROP_KEYS = ('head_r', 'neck', 'torso', 'torso_w', 'uarm', 'farm', 'thigh', 'shin',
             'limb_w', 'hip_w', 'sh_w', 'hunch', 'belly', 'foot')

PROPS = {
    #          head_r neck torso torso_w uarm farm thigh shin limb_w hip_w sh_w hunch belly foot
    'baby':   (52,   2,   92,   72,    44,  40,  50,   44,  25,    14,   18,   0,    0,   13),
    'kid':    (48,   6,   110,  54,    60,  54,  70,   64,  21,    12,   15,   0,    0,   15),
    'school': (46,   9,   140,  50,    80,  72,  96,   90,  21,    12,   15,   0,    0,   17),
    'army':   (46,   13,  178,  54,    98,  90,  128,  122, 22,    13,   17,   0,    0,   19),
    'teen':   (46,   13,  180,  52,   100,  92,  130,  124, 21,    13,   16,   0,    0,   19),
    'office': (47,   11,  180,  58,    98,  90,  126,  120, 22,    13,   17,   7,    10,  19),
    'plaza':  (48,   9,   176,  64,    96,  88,  122,  116, 22,    14,   18,   9,    34,  19),
    'old':    (47,   7,   168,  58,    94,  88,  116,  110, 20,    13,   17,   24,   16,  18),
    # the crowd
    'auntie': (44,   8,   150,  62,    82,  76,  100,  96,  21,    13,   16,   6,    30,  16),
}
PROPS = {k: dict(zip(PROP_KEYS, v)) for k, v in PROPS.items()}


def mix_props(a, b, u):
    return {k: a[k] + (b[k] - a[k]) * u for k in PROP_KEYS}


# ---------------------------------------------------------------- pose channels
DEFAULT = dict(
    x=0.0, px=0.0, py=0.0, rot=0.0, sit=0.0,
    spine=0.0, neck=0.0, head=0.0,
    shL=-7.0, elL=-8.0, shR=7.0, elR=8.0, wrL=0.0, wrR=0.0,
    fLx=-0.17, fLy=0.0, fRx=0.17, fRy=0.0, plantL=1.0, plantR=1.0, kL=-1.0, kR=1.0,
    glide=0.0, toeL=0.0, toeR=0.0,
    face=0.0, spin=0.0,
    brow=0.0, browTilt=0.35, eye=1.0, dizzy=0.0, mouth=0.0, mouthOpen=0.0,
    handL=0.0, handR=0.0, facerot=0.0, fan=0.0,
)
CHANNELS = tuple(DEFAULT.keys())

ROOT_CH = ('x', 'px', 'py', 'rot', 'sit')
FOOT_CH = ('fLx', 'fLy', 'fRx', 'fRy', 'plantL', 'plantR', 'kL', 'kR', 'glide', 'toeL', 'toeR')
FACE_CH = ('face', 'spin', 'brow', 'browTilt', 'eye', 'dizzy', 'mouth', 'mouthOpen', 'handL', 'handR', 'facerot')
LIMB_CH = tuple(c for c in CHANNELS if c not in ROOT_CH + FOOT_CH + FACE_CH)
LEFT_CH = ('shL', 'elL', 'wrL')
RIGHT_CH = ('shR', 'elR', 'wrR')

# Channels that are written in "outward" convention by the front-view helper F():
# the screen-left side is mirrored (negated).
_MIRROR_PAIRS = {'sh': ('shL', 'shR'), 'el': ('elL', 'elR'), 'wr': ('wrL', 'wrR'),
                 'fx': ('fLx', 'fRx'), 'k': ('kL', 'kR'), 'toe': ('toeL', 'toeR')}
_PLAIN_PAIRS = {'fy': ('fLy', 'fRy'), 'plant': ('plantL', 'plantR'), 'hand': ('handL', 'handR')}


def F(base=None, **kw):
    """Front-view pose. Pairs are (screen-left, screen-right) in outward convention:
    sh=(90, 90) is both arms straight out sideways, fx=(.3, .3) a wide stance."""
    p = dict(DEFAULT if base is None else base)
    for k, v in kw.items():
        if k in _MIRROR_PAIRS:
            l, r = _MIRROR_PAIRS[k]
            if v[0] is not None:
                p[l] = -v[0]
            if v[1] is not None:
                p[r] = v[1]
        elif k in _PLAIN_PAIRS:
            l, r = _PLAIN_PAIRS[k]
            if v[0] is not None:
                p[l] = v[0]
            if v[1] is not None:
                p[r] = v[1]
        else:
            p[k] = v
    return p


def S(base=None, facing=1, **kw):
    """Side-view pose, values in "forward" convention (forward = the facing direction).
    sh=(90, 90): both arms straight forward.  fx forward positive.  k=+1 knees forward."""
    p = dict(DEFAULT if base is None else base)
    p['face'] = facing
    sgn = 1 if facing >= 0 else -1
    for k, v in kw.items():
        if k in _MIRROR_PAIRS:
            l, r = _MIRROR_PAIRS[k]
            if v[0] is not None:
                p[l] = sgn * v[0]
            if v[1] is not None:
                p[r] = sgn * v[1]
        elif k in _PLAIN_PAIRS:
            l, r = _PLAIN_PAIRS[k]
            if v[0] is not None:
                p[l] = v[0]
            if v[1] is not None:
                p[r] = v[1]
        elif k in ('rot', 'spine', 'neck', 'head'):
            p[k] = -sgn * v            # positive = lean / tilt forward
        elif k == 'px':
            p[k] = sgn * v             # positive = weight forward
        else:
            p[k] = v
    if 'k' not in kw:
        p['kL'] = p['kR'] = sgn
    if 'fx' not in kw:
        p['fLx'], p['fRx'] = -0.05 * sgn, 0.05 * sgn
    return p


def mod(p, **kw):
    """Copy of pose p with raw channel overrides (internal convention)."""
    q = dict(p)
    q.update(kw)
    return q


# ---------------------------------------------------------------- math helpers
def rot(v, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (v[0] * c - v[1] * s, v[0] * s + v[1] * c)


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def mul(a, k):
    return (a[0] * k, a[1] * k)


def lerp(a, b, u):
    return a + (b - a) * u


def lerp2(a, b, u):
    return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)


def down(deg):
    """Unit vector of 'hanging down' rotated by deg (CCW)."""
    a = math.radians(deg)
    return (math.sin(a), -math.cos(a))


def smin(a, b, k):
    """Smooth minimum (k = blend width)."""
    if k <= 0:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * k * 0.25


@dataclass
class Rig:
    """Solved joint positions (world coords) plus everything the renderer needs."""
    pose: dict
    pr: dict
    anchor: tuple
    pelvis: tuple
    chest: tuple
    neck_top: tuple
    head: tuple
    head_ang: float
    body_ang: float
    shL: tuple
    elL: tuple
    wrL: tuple
    shR: tuple
    elR: tuple
    wrR: tuple
    hipL: tuple
    knL: tuple
    anL: tuple
    hipR: tuple
    knR: tuple
    anR: tuple
    toeL: tuple
    toeR: tuple
    hand_angL: float
    hand_angR: float
    scale_x: float = 1.0


def _ik(hip, foot, l1, l2, k):
    d = math.hypot(foot[0] - hip[0], foot[1] - hip[1])
    reach = (l1 + l2) * 0.9995
    if d < 1e-6:
        return hip, foot
    u = ((foot[0] - hip[0]) / d, (foot[1] - hip[1]) / d)
    if d > reach:
        foot = add(hip, mul(u, reach))
        d = reach
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0.0))
    perp = (-u[1], u[0])
    knee = add(add(hip, mul(u, a)), mul(perp, h * k))
    return knee, foot


def solve(p, pr, home_x=0.0):
    """Solve a pose with proportions pr. home_x is the world x of this character's spot."""
    L = pr['thigh'] + pr['shin']
    ankle_h = pr['limb_w'] * 0.5
    ax = home_x + p['x']
    anchor = (ax, 0.0)
    stand_h = ankle_h + L * 0.965
    sit_h = pr['torso_w'] * 0.42
    py = lerp(stand_h + p['py'] * L, sit_h + p['py'] * L * 0.4, p['sit'])
    pel = (ax + p['px'] * L, py)
    body = p['rot']
    hipL0 = add(pel, rot((-pr['hip_w'], 0), body))
    hipR0 = add(pel, rot((pr['hip_w'], 0), body))

    def foot_target(side, hip):
        fx, fy, plant = (p['fLx'], p['fLy'], p['plantL']) if side == 'L' else (p['fRx'], p['fRy'], p['plantR'])
        planted = (ax + fx * L, ankle_h + fy * L)
        free = add(hip, rot((fx * L, (fy - 0.965) * L), body))   # free: offset from the hip, body frame
        return lerp2(free, planted, plant), plant, planted

    # lower the pelvis if a planted foot would be out of reach (never let a foot hover)
    for side, hip in (('L', hipL0), ('R', hipR0)):
        ft, plant, planted = foot_target(side, hip)
        if plant > 0.5 and p['sit'] < 0.5:
            dx = hip[0] - planted[0]
            reach = L * 0.992
            if abs(dx) < reach:
                maxy = planted[1] + math.sqrt(reach * reach - dx * dx) - (hip[1] - pel[1])
                w = min(1.0, (plant - 0.5) * 2)
                newy = smin(pel[1], maxy, L * 0.04)
                pel = (pel[0], lerp(pel[1], newy, w))
    hipL = add(pel, rot((-pr['hip_w'], 0), body))
    hipR = add(pel, rot((pr['hip_w'], 0), body))
    ftL, _, _ = foot_target('L', hipL)
    ftR, _, _ = foot_target('R', hipR)
    knL, anL = _ik(hipL, ftL, pr['thigh'], pr['shin'], p['kL'])
    knR, anR = _ik(hipR, ftR, pr['thigh'], pr['shin'], p['kR'])

    # torso (hunch shortens the effective torso a little and drops the head forward)
    tang = body + p['spine']
    hunch = pr['hunch']
    face = p['face']
    fdir = 1 if face >= 0 else -1
    chest = add(pel, rot((0, pr['torso'] * (1 - 0.0045 * hunch)), tang))
    # shoulders sit just under the top of the torso capsule
    shd = pr['limb_w'] * 0.35
    shL = add(chest, rot((-pr['sh_w'], -shd), tang))
    shR = add(chest, rot((pr['sh_w'], -shd), tang))
    # neck + head
    hunch_fwd = -hunch * (0.35 + 0.65 * abs(face)) * fdir
    nang = tang + p['neck'] + hunch_fwd * 1.1
    neck_top = add(chest, rot((0, pr['neck'] + pr['head_r'] * 0.15), nang))
    head_ang = nang + p['head']
    head = add(neck_top, rot((0, pr['head_r'] * 0.85), head_ang))

    elL = add(shL, mul(down(tang + p['shL']), pr['uarm']))
    wrL = add(elL, mul(down(tang + p['shL'] + p['elL']), pr['farm']))
    elR = add(shR, mul(down(tang + p['shR']), pr['uarm']))
    wrR = add(elR, mul(down(tang + p['shR'] + p['elR']), pr['farm']))
    hand_angL = tang + p['shL'] + p['elL'] + p['wrL']
    hand_angR = tang + p['shR'] + p['elR'] + p['wrR']

    # toes: perpendicular to the shin, pointing outward (front view) or forward (side view)
    def toe(kn, an, side, toe_off):
        sh = sub(an, kn)
        n = math.hypot(*sh) or 1.0
        sh = (sh[0] / n, sh[1] / n)
        out = -1.0 if side == 'L' else 1.0
        want = lerp(out, fdir, min(1.0, abs(face) * 1.4))
        perp = (-sh[1], sh[0])          # CCW of shin direction
        if perp[0] * want < 0:
            perp = (sh[1], -sh[0])
        perp = rot(perp, toe_off * (1 if perp[0] >= 0 else -1))
        return add(an, mul(perp, pr['foot']))

    toeL = toe(knL, anL, 'L', p['toeL'] * (-1))
    toeR = toe(knR, anR, 'R', p['toeR'])

    rig = Rig(p, pr, anchor, pel, chest, neck_top, head, head_ang, tang,
              shL, elL, wrL, shR, elR, wrR, hipL, knL, anL, hipR, knR, anR, toeL, toeR,
              hand_angL, hand_angR)
    sx = math.cos(math.radians(p['spin']))
    if abs(sx - 1) > 1e-4:
        cx = pel[0]
        for name in ('pelvis', 'chest', 'neck_top', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR',
                     'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR', 'toeL', 'toeR'):
            v = getattr(rig, name)
            setattr(rig, name, (cx + (v[0] - cx) * sx, v[1]))
        rig.scale_x = sx
    return rig
