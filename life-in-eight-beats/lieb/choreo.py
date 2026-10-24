"""Choreography: every key pose of the film, placed by (segment, beat).

Conventions (see skeleton.F / skeleton.S):
  F(...)  front view, pairs are (screen-left, screen-right) in outward convention
          (sh=0 arm down, 90 out sideways, 180 up; fx>0 = foot out to the side)
  S(...)  side view facing right (facing=-1: left); sh=90 arm forward, fx>0 foot forward
  raw()   internal values (used for lying / sitting poses)

Times never appear here: only beats.  Gag beats that also make a sound are read
from the timeline cues (whistle, cough, crack ...), so picture and sound agree.
"""
import math

from .skeleton import F, S, mod, DEFAULT
from .anim import Track
from .timeline import TL

SERIOUS = dict(browTilt=0.45, brow=0.0, mouth=0.0)


def raw(base=None, **kw):
    p = dict(DEFAULT if base is None else base)
    p.update(kw)
    return p


def lying(**kw):
    """On the back, head to screen-left, legs and arms in the air (internal values)."""
    p = raw(rot=90, sit=1, py=0.35, plantL=0, plantR=0, kL=1, kR=1, face=0, facerot=-75, head=-8,
            fLx=0.55, fLy=0.75, fRx=0.6, fRy=0.7, shL=80, elL=70, shR=95, elR=60, **SERIOUS)
    p.update(kw)
    return p


def stand(**kw):
    p = F(**SERIOUS)
    return F(p, **kw)


def side(facing=1, **kw):
    p = S(facing=facing, **SERIOUS)
    return S(p, facing=facing, **kw)


# ============================================================ S1  baby
def s1(tr):
    st = 'baby'
    tr.at('S1', -1.0, lying(), st)
    tr.at('S1', 0, lying(fRx=0.97, fRy=0.92, fLx=0.45, fLy=0.72, shR=105, elR=5, shL=55, elL=105), st)
    tr.at('S1', 1, lying(fLx=0.97, fLy=0.9, fRx=0.5, fRy=0.75, shL=110, elL=0, shR=60, elR=100), st)
    tr.at('S1', 2, lying(fLx=0.95, fLy=0.98, fRx=0.95, fRy=0.95, shL=100, elL=12, shR=92, elR=8, brow=0.25), st)
    tr.at('S1', 3, lying(fRx=0.72, fRy=0.4, fLx=0.5, fLy=0.75, shL=140, elL=-30, shR=50, elR=95), st)
    # 翻身坐起: rock back (anticipation), swing up, sit
    tr.at('S1', 4, lying(rot=101, py=0.9, fLx=0.75, fLy=1.2, fRx=0.8, fRy=1.15, shL=170, elL=10, shR=165, elR=15, head=-14), st)
    tr.at('S1', 5, raw(rot=42, sit=1, py=0.2, plantL=0.4, plantR=0.4, fLx=-0.6, fRx=0.6, fLy=0.25, fRy=0.25,
                       kL=-1, kR=1, shL=-80, elL=-20, shR=80, elR=20, **SERIOUS), st)
    sit = F(sit=1, py=0.0, fx=(0.78, 0.78), fy=(0, 0), k=(1, 1), sh=(32, 32), el=(-25, -25), **SERIOUS)
    tr.at('S1', 6, sit, st)
    tr.at('S1', 7, F(sit, rot=-6, sh=(130, 140), el=(10, 5), head=6), st)
    # 摇摇晃晃站起来: lean on the right hand, bum up, up
    tr.at('S1', 8, F(sit, rot=-34, px=0.12, sh=(150, 55), el=(20, 0), fx=(0.62, 0.7), head=14), st)
    tr.at('S1', 9, F(sit=0, py=-0.32, rot=-14, px=0.06, fx=(0.42, 0.42), k=(1, 1), sh=(70, 30), el=(20, -10), **SERIOUS), st)
    tr.at('S1', 10, stand(py=-0.06, fx=(0.3, 0.3), sh=(96, 92), el=(12, -8), brow=0.35), st)
    tr.at('S1', 11, stand(py=-0.05, rot=8, px=-0.05, fx=(0.3, 0.3), sh=(70, 125), el=(-10, 25), head=-8), st)
    tr.at('S1', 12, stand(py=-0.05, rot=-9, px=0.06, fx=(0.18, 0.3), sh=(128, 66), el=(30, -15), head=9), st)
    tr.at('S1', 13, stand(py=-0.07, rot=6, px=-0.02, fx=(0.18, 0.4), sh=(158, 55), el=(25, -40), head=-6), st)
    tr.at('S1', 14, stand(py=-0.06, rot=-5, fx=(0.3, 0.3), sh=(48, 160), el=(-35, 30), head=5), st)
    tr.at('S1', 15, stand(py=-0.04, fx=(0.24, 0.24), sh=(64, 64), el=(-70, -70), brow=0.15), st)


# ============================================================ S2  kindergarten
def clap(**kw):
    return stand(fx=(0.16, 0.16), sh=(26, 26), el=(-102, -102), **kw)


def s2(tr):
    st = 'silly'
    # the flailing arms of S1 land in a clap on the downbeat
    tr.at('S2', 0, clap(), st)
    tr.at('S2', 1, clap(py=-0.1, rot=4), st)
    tr.at('S2', 2, stand(fx=(0.16, 0.16), sh=(165, 165), el=(35, 35), py=0.02), st)
    tr.at('S2', 3, stand(fx=(0.22, 0.22), py=-0.16, sh=(8, 8), el=(-95, -95), rot=-3), st)
    # 一闪一闪亮晶晶: twinkling hands
    tw = dict(hand=(1, 1))
    tr.at('S2', 4, stand(rot=7, px=-0.04, sh=(150, 118), el=(28, 70), wr=(-25, 25), **tw), st)
    tr.at('S2', 4.5, stand(rot=7, px=-0.04, sh=(150, 118), el=(28, 70), wr=(25, -25), **tw), st)
    tr.at('S2', 5, stand(rot=-7, px=0.04, sh=(118, 150), el=(70, 28), wr=(-25, 25), **tw), st)
    tr.at('S2', 5.5, stand(rot=-7, px=0.04, sh=(118, 150), el=(70, 28), wr=(25, -25), **tw), st)
    tr.at('S2', 6, stand(py=-0.06, sh=(95, 95), el=(-15, -15), wr=(30, 30), **tw), st)
    tr.at('S2', 7, stand(fx=(0.3, 0.3), py=0.02, sh=(158, 158), el=(0, 0), wr=(0, 0), brow=0.2, **tw), st)
    # 原地转圈: airplane arms, two full turns, linear angular speed
    air = stand(fx=(0.16, 0.16), sh=(95, 95), el=(5, 5), hand=(0, 0))
    tr.at('S2', 8, F(air, spin=0), 'spin')
    tr.at('S2', 9, F(air, spin=200, rot=-5), 'spin')
    tr.at('S2', 10, F(air, spin=420, rot=5), 'spin')
    tr.at('S2', 11, F(air, spin=600, rot=-4), 'spin')
    tr.at('S2', 12, F(air, spin=720, sh=(60, 60), el=(-10, -10), dizzy=1, brow=-0.3, browTilt=-0.3), 'spin')
    # dizzy: circling sway, mosquito-coil eyes
    dz = dict(dizzy=1, brow=-0.3, browTilt=-0.3, spin=720)
    tr.at('S2', 12.5, stand(rot=12, px=-0.06, sh=(40, 75), el=(-20, 20), **dz), st)
    tr.at('S2', 13, stand(rot=-10, px=0.07, sh=(80, 35), el=(30, -10), head=12, **dz), st)
    tr.at('S2', 13.5, stand(rot=9, px=0.02, sh=(30, 55), el=(-5, 10), head=-10, **dz), st)
    tr.at('S2', 14, stand(rot=-7, px=-0.04, sh=(50, 30), el=(10, -10), head=8, **dz), st)
    # the whistle: snap to attention, then the gymnastics ready position
    att = stand(fx=(0.07, 0.07), sh=(4, 4), el=(0, 0), spin=720, brow=0.9, browTilt=0.2)
    tr.at('S2', 14.5, att, 'military')
    tr.at('S2', 15, F(att, brow=0.1, browTilt=0.5), 'drill')


# ============================================================ S3  primary school
def gym_moves():
    """The (invented) radio-gymnastics routine, correct version: list of (beat, pose, kind).
    kind marks moves where arm/leg pairing matters (for the 顺拐 version)."""
    att = stand(fx=(0.07, 0.07), sh=(4, 4), el=(0, 0))
    m = []
    # eight 1 — 伸展运动
    m.append((0, stand(fx=(0.07, 0.36), sh=(158, 158), el=(0, 0)), None))
    m.append((1, stand(fx=(0.07, 0.36), sh=(90, 90), el=(0, 0)), None))
    m.append((2, stand(fx=(0.07, 0.36), sh=(165, 165), el=(0, 0), py=0.025), None))
    m.append((3, att, None))
    m.append((4, stand(fx=(0.36, 0.07), sh=(158, 158), el=(0, 0)), None))
    m.append((5, stand(fx=(0.36, 0.07), sh=(90, 90), el=(0, 0)), None))
    m.append((6, stand(fx=(0.36, 0.07), sh=(165, 165), el=(0, 0), py=0.025), None))
    m.append((7, att, None))
    # eight 2 — 扩胸 + 踢腿
    bent = stand(fx=(0.2, 0.2), sh=(90, 90), el=(-168, -168))
    m.append((8, bent, None))
    m.append((9, stand(fx=(0.2, 0.2), sh=(92, 92), el=(0, 0), neck=0, py=-0.02), None))
    m.append((10, bent, None))
    m.append((11, stand(fx=(0.2, 0.2), sh=(132, 132), el=(0, 0)), None))
    # kick the left leg out, right arm up (correct pairing: opposite arm)
    m.append((12, stand(fx=(0.5, 0.08), fy=(0.62, 0), plant=(0, 1), k=(1, 1), sh=(90, 142), el=(0, 10), rot=-4), 'kickL'))
    m.append((13, att, None))
    m.append((14, stand(fx=(0.08, 0.5), fy=(0, 0.62), plant=(1, 0), k=(1, 1), sh=(142, 90), el=(10, 0), rot=4), 'kickR'))
    m.append((15, att, None))
    # eight 3 — 整理运动: 向右转, march in place → 齐步 → 正步 (side view)
    for i, b in enumerate(range(16, 24)):
        left_up = (i % 2 == 0)
        if b < 20:      # 原地踏步: small knees, relaxed swing
            lift, swing_f, swing_b, el = 0.17, 42, -28, 25
        elif b < 22:    # 齐步: straight back arm, front arm bent across the chest
            lift, swing_f, swing_b, el = 0.13, 70, -38, 70
        else:           # 正步: straight kicking leg, stiff arms
            lift, swing_f, swing_b, el = None, 85, -45, 85
        if lift is not None:
            fy = (lift, 0) if left_up else (0, lift)
            fx = (0.04, -0.02) if left_up else (-0.02, 0.04)
            p = side(fx=fx, fy=fy, k=(1, 1))
        else:
            # goose step: the lifted leg is straight and forward
            if left_up:
                p = side(fx=(0.62, -0.02), fy=(0.75, 0), plant=(0, 1), k=(1, 1), rot=-3)
            else:
                p = side(fx=(-0.02, 0.62), fy=(0, 0.75), plant=(1, 0), k=(1, 1), rot=-3)
        # correct pairing: opposite arm forward
        if left_up:
            arms = dict(sh=(swing_b, swing_f), el=(10, el))
        else:
            arms = dict(sh=(swing_f, swing_b), el=(el, 10))
        p = S(p, **arms)
        m.append((b, p, 'marchL' if left_up else 'marchR'))
    return m


def shunguai(pose, kind):
    """顺拐: the same-side arm goes with the leg."""
    if kind in ('kickL', 'kickR'):
        p = dict(pose)
        p['shL'], p['shR'] = -pose['shR'], -pose['shL']
        p['elL'], p['elR'] = -pose['elR'], -pose['elL']
        return p
    if kind in ('marchL', 'marchR'):
        p = dict(pose)
        p['shL'], p['shR'] = pose['shR'], pose['shL']
        p['elL'], p['elR'] = pose['elR'], pose['elL']
        return p
    return pose


def s3(tr, crowd=None):
    moves = gym_moves()
    # the hero is still at attention when the music starts: his late move is a hurried snap
    tr.at('S3', 0, stand(fx=(0.07, 0.07), sh=(4, 4), el=(0, 0), browTilt=0.55), 'drill')
    for b, pose, kind in moves:
        st = 'drill' if b < 22 else 'military'
        if crowd is not None:
            crowd.at('S3', b, pose, st)
        # the hero: half a beat late, and 顺拐, and very serious about it
        p = shunguai(pose, kind)
        p = dict(p, browTilt=0.55, brow=-0.05)
        tr.at('S3', b + 0.5, p, st)


# ============================================================ S4  military training
def s4(tr):
    # 立定 on the downbeat (puff → camo), then 站军姿 in the sun, dozing
    att = side(fx=(0.0, 0.03), sh=(-3, -3), el=(0, 0), browTilt=0.5)
    tr.at('S4', 0, att, 'military')
    nods = [(0.5, 1, 14, 0.45), (1.5, 2, 24, 0.2), (2.5, 3, 38, 0.0)]
    for b_down, b_hold, neck, eye in nods:
        # slow droop of the head (sleepy), sharp little recovery just before the beat
        tr.at('S4', b_down, S(att, neck=neck, eye=eye, brow=-0.2, browTilt=-0.1, spine=neck * 0.15), 'office')
        tr.at('S4', b_hold, S(att, neck=neck * 0.25, eye=0.35, browTilt=0.2), 'military')
    tr.at('S4', 3.75, S(att, neck=44, spine=8, eye=0.0, py=-0.03, brow=-0.3, browTilt=-0.2), 'office')
    # 哨声 on beat 4: startled hop
    tr.at('S4', 4, S(att, py=0.06, eye=1.0, brow=1.0, browTilt=0.0, sh=(-12, -12), mouthOpen=0.4), 'military')
    tr.at('S4', 4.25, S(att, eye=1.0, brow=0.4, browTilt=0.6), 'military')
    # 正步 x3: dead straight leg, stomp on the beat
    for i, b in enumerate((5, 6, 7)):
        left = (i % 2 == 0)
        kick = side(fx=(0.66, -0.02) if left else (-0.02, 0.66), fy=(0.82, 0) if left else (0, 0.82),
                    plant=(0, 1) if left else (1, 0), k=(1, 1), rot=-2,
                    sh=(-48, 92) if left else (92, -48), el=(0, 80) if left else (80, 0), browTilt=0.7)
        tr.at('S4', b - 0.5, kick, 'military')
        stomp = side(fx=(0.18, -0.06) if left else (-0.06, 0.18), sh=(-35, 60) if left else (60, -35),
                     el=(0, 70) if left else (70, 0), py=-0.03, browTilt=0.7)
        tr.at('S4', b, stomp, 'military')


# ============================================================ S5  teenager
def s5(tr):
    rb = 'robot'
    # the rigid soldier turns to the front in robot clicks
    base = stand(fx=(0.2, 0.2), sh=(5, 5), el=(0, 0), browTilt=0.4)
    tr.at('S5', 0, F(base, face=0.0, head=0), rb)
    tr.at('S5', 1, F(base, sh=(5, 90), el=(0, 90), head=-12), rb)
    tr.at('S5', 1.5, F(base, sh=(90, 90), el=(90, 90), head=0), rb)
    tr.at('S5', 2, F(base, sh=(90, 90), el=(-90, -90), spine=10, head=-10), rb)
    tr.at('S5', 3, F(base, sh=(90, 90), el=(-90, -90), spine=-10, head=12), rb)
    # arm wave: elbow → wrist → other arm, clicks on 16ths
    tr.at('S5', 3.25, F(base, sh=(80, 100), el=(-30, 40), spine=-4), rb)
    tr.at('S5', 3.5, F(base, sh=(100, 80), el=(40, -30), spine=4), rb)
    tr.at('S5', 4, F(base, fx=(0.2, 0.2), fy=(0.16, 0), sh=(60, 120), el=(-60, -10), py=-0.03), rb)
    tr.at('S5', 5, F(base, fx=(0.2, 0.2), fy=(0, 0.16), sh=(120, 60), el=(-10, -60), py=-0.03), rb)
    # into 摇花手 (hand rolls): scratch on beat 6
    roll_c = dict(fx=(0.24, 0.24), py=-0.06, hand=(1, 1))
    for k in range(8):
        b = 6 + k * 0.5
        ph = k * math.pi * 0.5 * 1.5
        sway = math.sin(k * math.pi / 2)
        tr.at('S5', b, stand(sh=(48 + 22 * math.cos(ph), 48 + 22 * math.cos(ph + math.pi)),
                             el=(-115 + 35 * math.sin(ph), -115 + 35 * math.sin(ph + math.pi)),
                             wr=(55 * (-1) ** k, -55 * (-1) ** k), rot=4 * sway, px=0.04 * sway,
                             head=-6 * sway, browTilt=0.35, **roll_c), 'street')
    # 太空步 (moonwalk), facing right, gliding backwards: the flat foot slides, the other stays
    s_ = 0.26
    x0 = 0.0
    Lunit = 1.0     # fx is in leg lengths; x in px — convert with the teen's leg length
    from .skeleton import PROPS
    L = PROPS['teen']['thigh'] + PROPS['teen']['shin']
    pos = {'L': 0.0, 'R': 0.0}       # world foot positions (in L units), relative to x0
    body = 0.0
    for k in range(5):               # beats 10..14
        b = 10 + k
        toe_side = 'L' if k % 2 == 0 else 'R'
        flat_side = 'R' if toe_side == 'L' else 'L'
        fx = {sd: pos[sd] - body for sd in 'LR'}
        p = side(fx=(fx['L'], fx['R']), fy=(0.05 if toe_side == 'L' else 0, 0.05 if toe_side == 'R' else 0),
                 toe=(-35 if toe_side == 'L' else 0, -35 if toe_side == 'R' else 0),
                 sh=(30, -15) if k % 2 == 0 else (-15, 30), el=(60, 20) if k % 2 == 0 else (20, 60),
                 py=-0.03, glide=1, neck=8 if k % 2 == 0 else -4, browTilt=0.5)
        p['x'] = x0 + body * L
        tr.at('S5', b, p, 'glide')
        if k < 4:
            pos[flat_side] -= 2 * s_
            body -= s_
    # 14 → 16: 摇花手 again, but slowing down, sinking onto the chair that slides in
    xend = x0 + body * L
    slow = [14.5, 15.0, 15.5]
    phases = [0.0, 0.7, 1.05]                # the rolls run out of steam
    for k, b in enumerate(slow):
        ph = phases[k] * math.pi
        u = k / (len(slow) - 1)
        p = stand(sh=(40 + 20 * math.cos(ph), 40 + 20 * math.cos(ph + math.pi)),
                  el=(-110 + 30 * math.sin(ph), -110 + 30 * math.sin(ph + math.pi)),
                  wr=(40 * (-1) ** k * (1 - u), -40 * (-1) ** k * (1 - u)), fx=(0.2, 0.2),
                  py=-0.05 - 0.25 * u, hand=(1, 1), browTilt=0.4 - 0.6 * u, eye=1 - 0.3 * u)
        p['x'] = xend
        tr.at('S5', b, p, 'street')
    return xend


# ============================================================ S6  office worker
def s6(tr, x):
    st = 'office'
    tired = dict(browTilt=-0.35, brow=-0.15, eye=0.62, x=x)
    seat = dict(py=-0.43, fx=(0.28, 0.28), k=(1, 1))
    type_ = dict(sh=(22, 22), el=(-62, -62))
    tr.at('S6', 0, stand(**seat, **type_, **tired), st)
    tr.at('S6', 0.5, stand(**seat, sh=(24, 20), el=(-55, -66), **tired), st)
    tr.at('S6', 1, stand(**seat, sh=(20, 24), el=(-66, -55), **tired), st)
    tr.at('S6', 1.5, stand(**seat, **type_, **tired), st)
    # 转脖子 with 咔 — each crack is a cue on the timeline
    cr = [q.beat for q in TL.find('sfx', 'crack', 'S6')]       # [2, 3, 4, 4.5]
    tr.at('S6', cr[0], stand(**seat, **type_, neck=-26, head=-6, **tired), 'drill')
    tr.at('S6', cr[1], stand(**seat, **type_, neck=24, head=6, **tired), 'drill')
    tr.at('S6', cr[2], stand(**seat, **type_, neck=-12, head=-24, **dict(tired, eye=0.3)), 'drill')
    tr.at('S6', cr[3], stand(**seat, **type_, neck=0, head=0, **tired), 'drill')
    tr.at('S6', 5.5, stand(**seat, **type_, **tired), st)
    # 伸懒腰 + sigh
    tr.at('S6', 6.5, stand(**seat, sh=(162, 162), el=(25, 25), spine=0, eye=0.0, mouthOpen=0.9,
                           browTilt=-0.5, brow=0.2, x=x, hand=(1, 1)), st)
    tr.at('S6', 7.5, stand(**seat, sh=(60, 60), el=(-60, -60), **tired), st)
    # stand up (chair rolls away), interlace fingers
    tr.at('S6', 9, stand(py=-0.02, fx=(0.18, 0.18), sh=(14, 14), el=(-72, -72), **tired), st)
    # 八段锦 两手托天理三焦
    tr.at('S6', 10, stand(fx=(0.18, 0.18), sh=(14, 14), el=(-78, -78), hand=(1, 1), **tired), st)
    tr.at('S6', 11, stand(fx=(0.18, 0.18), sh=(32, 32), el=(-150, -150), hand=(1, 1), **tired), st)
    tr.at('S6', 12, stand(fx=(0.18, 0.18), sh=(170, 170), el=(14, 14), py=0.03, neck=0, head=0,
                          hand=(1, 1), **dict(tired, eye=0.8, browTilt=0.1)), st)
    tr.at('S6', 13, stand(fx=(0.18, 0.18), sh=(92, 92), el=(0, 0), hand=(1, 1), **tired), st)
    tr.at('S6', 14, stand(fx=(0.18, 0.18), sh=(14, 14), el=(-78, -78), hand=(1, 1), **tired), st)
    tr.at('S6', 15, stand(fx=(0.18, 0.18), sh=(32, 32), el=(-150, -150), hand=(1, 1), **tired), st)


# ============================================================ S7  middle age (square dance)
def plaza_moves(x):
    """Square-dance keys (beats 0..15 of S7), shared by the hero and the aunties."""
    m = []
    up = dict(x=x)
    # 啪! fans burst open in the 托天 position
    m.append((0, stand(fx=(0.2, 0.2), sh=(165, 165), el=(14, 14), py=0.02, fan=1.15, wr=(0, 0), **up)))
    m.append((1, stand(fx=(0.2, 0.36), sh=(70, 120), el=(40, 30), wr=(30, -20), fan=1.0, rot=-5, **up)))
    m.append((2, stand(fx=(0.36, 0.2), sh=(120, 70), el=(30, 40), wr=(-20, 30), fan=1.0, rot=5, **up)))
    m.append((3, stand(fx=(0.25, 0.25), sh=(150, 150), el=(40, 40), wr=(20, 20), fan=1.0, py=-0.05, **up)))
    # basic step-touch, fans up / down
    for i, b in enumerate(range(4, 8)):
        r = (i % 2 == 0)
        m.append((b, stand(fx=(0.12, 0.38) if r else (0.38, 0.12), sh=(40, 150) if r else (150, 40),
                           el=(30, 10) if r else (10, 30), wr=(10, -30) if r else (-30, 10),
                           rot=-6 if r else 6, px=0.05 if r else -0.05, fan=1.0, py=-0.03, **up)))
    # bouncing hip-twist with fans at the shoulders
    for i, b in enumerate(range(8, 12)):
        low = (i % 2 == 0)
        m.append((b, stand(fx=(0.28, 0.28), py=-0.14 if low else 0.0, sh=(105, 105), el=(80, 80),
                           wr=(60, -60) if low else (-60, 60), face=0.35 if low else -0.35,
                           rot=4 if low else -4, fan=1.0, **up)))
    return m


def s7(tr, x):
    for b, p in plaza_moves(x):
        tr.at('S7', b, p, 'square')
    # 转圈, slowing down — arms float wide with the fans
    spin = [(12, 0), (13, 300), (14, 520), (15, 660)]
    for b, a in spin:
        tr.at('S7', b, stand(fx=(0.18, 0.18), sh=(95, 95), el=(10, 10), fan=1.0, spin=a, x=x, py=-0.02), 'spin')


# ============================================================ S8  old age (tai chi)
def taichi_base(x, **kw):
    p = stand(fx=(0.24, 0.24), py=-0.1, face=0.35, x=x, browTilt=0.35, eye=0.8, hand=(1, 1))
    return F(p, **kw)


def cloud(x, phase, **kw):
    """云手: hands circling alternately in front of the body, weight following."""
    a = phase
    hi = lambda ph: 0.5 + 0.5 * math.cos(ph)
    uL, uR = hi(a), hi(a + math.pi)
    p = taichi_base(x, sh=(40 + 75 * uL, 40 + 75 * uR), el=(-60 - 50 * uL, -60 - 50 * uR),
                    wr=(-20, -20), px=0.07 * math.sin(a), rot=3 * math.sin(a),
                    face=0.3 * math.sin(a), head=-5 * math.sin(a))
    return F(p, **kw)


def s8(tr, x):
    tc = 'taichi'
    # the spin of S7 dies out into cloud hands
    tr.at('S8', 0, F(cloud(x, 0.0), spin=720), tc)
    for k in range(1, 8):
        b = k * 0.5
        tr.at('S8', b, F(cloud(x, k * math.pi / 2), spin=720), tc)
    # 起势: feet shoulder-wide, arms float up, press down, sink
    tr.at('S8', 4.5, taichi_base(x, sh=(30, 30), el=(-10, -10), py=-0.06, spin=720, face=0.2), tc)
    tr.at('S8', 5.5, taichi_base(x, sh=(88, 88), el=(-5, -5), wr=(-30, -30), py=-0.04, spin=720, face=0.2), tc)
    tr.at('S8', 6.5, taichi_base(x, sh=(70, 70), el=(-40, -40), wr=(30, 30), py=-0.12, spin=720, face=0.2), tc)
    tr.at('S8', 7.5, taichi_base(x, sh=(28, 28), el=(-35, -35), wr=(40, 40), py=-0.18, spin=720, face=0.2), tc)
    # FAST: kung-fu movie (4 beats at 2x)
    kf = 'kungfu'
    hb = dict(spin=720, x=x, eye=1.0, browTilt=0.8, brow=-0.1)
    tr.at('S8', 8, stand(fx=(0.42, 0.42), py=-0.22, sh=(30, 90), el=(-120, 0), hand=(0, 0), face=0.5, **hb), kf)
    tr.at('S8', 9, stand(fx=(0.32, 0.75), fy=(0, 0.95), plant=(1, 0), k=(1, 1), sh=(150, 100), el=(-60, 30),
                         rot=12, face=0.8, **hb), kf)
    tr.at('S8', 10, stand(fx=(0.42, 0.3), py=-0.18, sh=(130, 20), el=(-20, -100), rot=-6, face=-0.5, hand=(1, 0), **hb), kf)
    tr.at('S8', 11, stand(fx=(0.22, 0.18), fy=(0.45, 0), plant=(0, 1), k=(1, 1), sh=(160, 95), el=(30, 95),
                          face=0.6, hand=(1, 1), **hb), kf)
    # the tape stops: freeze, cough, pretend nothing happened
    S8 = TL.S['S8']
    t_freeze = S8.t(11) + S8.beat_len(11)
    pose11 = tr.keys[-1].pose
    tr.at_t(t_freeze, pose11, 'still')
    tc_ = TL.t_cough
    tr.at_t(tc_ - 0.05, F(pose11, browTilt=0.2), 'still')
    cough = stand(fx=(0.22, 0.2), py=-0.12, spine=-8, neck=-14, sh=(25, 40), el=(-40, -160), face=0.4,
                  x=x, spin=720, eye=0.0, brow=-0.4, browTilt=-0.3, mouthOpen=0.6, hand=(0, 0))
    tr.at_t(tc_ + 0.12, cough, 'kungfu')
    tr.at_t(tc_ + 0.36, F(cough, spine=-3, neck=-4, eye=0.4, mouthOpen=0.0), 'slow')
    # 白鹤亮翅: right hand up, left hand down, left toe forward (empty step)
    crane = taichi_base(x, fx=(0.34, 0.12), fy=(0.03, 0), toe=(-20, 0), py=-0.13, px=0.05,
                        sh=(18, 160), el=(-20, -40), wr=(20, -30), face=0.45, spin=720, eye=0.7, browTilt=0.3)
    tr.at('S8', 12, taichi_base(x, sh=(30, 30), el=(-30, -30), py=-0.1, spin=720, face=0.3), tc)
    tr.at('S8', 13, F(crane, sh=(20, 130), el=(-30, -60)), tc)
    tr.at('S8', 14, crane, tc)
    tr.at('S8', 15.5, F(crane, eye=0.75), 'still')


# ============================================================ S9  life flashes before his eyes
def s9_poses(x):
    return [
        ('baby', F(sit=1, fx=(0.6, 0.55), fy=(0, 0.55), plant=(1, 0), k=(1, 1), sh=(150, 40), el=(10, 90), x=x, **SERIOUS)),
        ('silly', stand(rot=7, sh=(150, 118), el=(28, 70), hand=(1, 1), x=x)),
        ('drill', stand(fx=(0.2, 0.2), sh=(92, 92), el=(0, 0), x=x)),
        ('military', side(fx=(0.66, -0.02), fy=(0.8, 0), plant=(0, 1), k=(1, 1), sh=(-48, 92), el=(0, 80), x=x)),
        ('street', stand(sh=(60, 30), el=(-130, -90), wr=(50, -50), py=-0.08, hand=(1, 1), x=x, fx=(0.25, 0.25))),
        ('office', stand(neck=-28, head=-6, sh=(14, 14), el=(-72, -72), x=x, fx=(0.18, 0.18), browTilt=-0.3, eye=0.6)),
        ('square', stand(fx=(0.12, 0.38), sh=(40, 150), el=(30, 10), fan=1.0, rot=-6, x=x, py=-0.03)),
        ('taichi', F(cloud(x, 0.0), spin=0)),
    ]


def s9(tr, x):
    for b, (st, p) in enumerate(s9_poses(x)):
        tr.at('S9', b, F(p, spin=0), st)


# ============================================================ S10  the end
def s10(tr, x):
    S10 = TL.S['S10']
    last = s9_poses(x)[-1][1]
    tr.at_t(TL.t_stop + 0.02, F(last, spin=0), 'still')            # dead stop, frozen
    sl = 'slow'
    tr.at('S10', 0, F(last, spin=0), sl)
    tr.at('S10', 1.5, taichi_base(x, sh=(20, 20), el=(-20, -20), py=-0.08, face=0.2, eye=0.6, wr=(20, 20)), sl)
    tr.at('S10', 3, F(sit=1, py=0.0, fx=(0.7, 0.7), k=(1, 1), sh=(40, 40), el=(-30, -30), face=0.2, x=x,
                      browTilt=0.3, eye=0.5, rot=-4), sl)
    tr.at('S10', 4.5, raw(rot=55, sit=1, py=0.25, plantL=0.6, plantR=0.6, fLx=-0.65, fRx=0.65, fLy=0.1, fRy=0.1,
                          kL=-1, kR=1, shL=-60, elL=-30, shR=60, elR=30, x=x, face=0, facerot=-45,
                          browTilt=0.3, eye=0.4), sl)
    lie = lying(x=x, fLx=0.06, fLy=0.04, fRx=0.12, fRy=0.08, shL=6, elL=0, shR=12, elR=0, eye=0.3,
                browTilt=0.25, head=-5, facerot=-80, py=0.3)
    tr.at('S10', 6, lie, sl)
    tr.at_t(TL.t_seven_end, F(lie, eye=0.0), sl)
    tr.at_t(TL.t_morph, F(lie, eye=0.0), 'still')
    # morph to baby (proportions change in look.py), eyes open, then the kick + 八!
    baby = lying(x=x, eye=1.0)
    tr.at_t(TL.t_morph + 0.25, baby, 'baby')
    kick = lying(x=x, fRx=0.98, fRy=0.95, fLx=0.45, fLy=0.72, shR=110, elR=0, shL=55, elL=100, eye=1.0, brow=0.1)
    tr.at_t(TL.t_eight, kick, 'kungfu')
    tr.at_t(TL.duration + 1, kick, 'still')


# ============================================================ build
def build():
    hero = Track(seed=7)
    pupils = Track(seed=11)
    s1(hero)
    s2(hero)
    # pupils stand at attention before the music starts
    pupils.at('S2', 15, stand(fx=(0.07, 0.07), sh=(4, 4), el=(0, 0)), 'drill')
    s3(hero, pupils)
    s4(hero)
    x = s5(hero)
    s6(hero, x)
    s7(hero, x)
    s8(hero, x)
    s9(hero, x)
    s10(hero, x)
    pupils.at('S4', 1, pupils.keys[-1].pose, 'still')
    return dict(hero=hero, pupils=pupils, x_after_moonwalk=x)
