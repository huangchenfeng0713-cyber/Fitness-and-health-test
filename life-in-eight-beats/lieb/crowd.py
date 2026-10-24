"""Extras: the pupils' formation (S3) and the square-dance aunties (S7-S8).

They reuse the hero's skeleton and renderer: smaller, offset in space, and each with a
tiny time offset so the crowd breathes instead of moving like one stamp.
"""
import math
import random

from .skeleton import F, S, PROPS, DEFAULT
from .anim import Track
from .choreo import stand, plaza_moves
from .timeline import TL

AUNTIE_TOPS = ['#B44FC9', '#18A999', '#F28A30', '#3F7CD8', '#E5486C', '#7BBF3A']
AUNTIE_HAIR = ['#2B1E1E', '#4A2A55', '#2B1E1E', '#5A2E1E', '#1E1E2B', '#3A2626']


def pupils_layout():
    """(dx, depth_y, scale, time_offset_beats) for the formation behind the hero."""
    rnd = random.Random(3)
    out = []
    rows = [(6, 300, 0.5, 205), (7, 370, 0.45, 180), (8, 435, 0.4, 158)]
    for r, (n, dy, sc, sp) in enumerate(rows):
        for i in range(n):
            dx = (i - (n - 1) / 2) * sp + (r % 2) * sp * 0.5 - sp * 0.25
            out.append((dx, dy, sc * rnd.uniform(0.96, 1.04), rnd.uniform(-0.035, 0.035)))
    out.sort(key=lambda m: -m[1])    # far rows first
    return out


def apply_gait(p, L, dist, direction):
    """Procedural walk: stance foot fixed in the world, swing foot arcs forward."""
    s = 0.42 * L
    ph = dist / s
    p = dict(p)
    for side, off in (('L', 0.0), ('R', 1.0)):
        q = (ph + off) % 2.0
        if q < 1.0:
            rel = s / 2 - q * s
            lift = 0.0
        else:
            u = q - 1.0
            rel = -s / 2 + u * s
            lift = 0.12 * math.sin(math.pi * u)
        p['f%sx' % side] = direction * rel / L
        p['f%sy' % side] = lift
        p['plant' + side] = 1.0
        p['k' + side] = direction
    # arms swing opposite to the legs
    sw = math.sin(ph * math.pi)
    p['shL'] = direction * (25 * sw)
    p['shR'] = direction * (-25 * sw)
    p['elL'] = p['elR'] = direction * 20
    p['face'] = direction
    return p


class Auntie:
    def __init__(self, idx, side, hero_x):
        self.idx = idx
        self.side = side                       # -1 left group, +1 right group
        k = idx % 3
        self.home = hero_x + side * (300 + 175 * k)
        self.start = hero_x + side * (1300 + 160 * k)
        self.exit = hero_x + side * (1500 + 160 * k)
        self.depth = 60 + 45 * k
        self.scale = 0.8 - 0.06 * k
        rnd = random.Random(100 + idx)
        self.toff = rnd.uniform(0.0, 0.06)
        self.top = AUNTIE_TOPS[idx % len(AUNTIE_TOPS)]
        self.hair = AUNTIE_HAIR[idx % len(AUNTIE_HAIR)]
        S7, S8 = TL.S['S7'], TL.S['S8']
        self.t_in0, self.t_in1 = S7.t(0) - 0.2 + 0.1 * k, S7.t(3.6)
        self.t_out0, self.t_out1 = S8.t(2.5) + 0.25 * k, S8.t(7.5) + 0.25 * k
        self.track = self._build()
        self.L = PROPS['auntie']['thigh'] + PROPS['auntie']['shin']

    def _build(self):
        tr = Track(seed=200 + self.idx)
        x = self.home
        moves = plaza_moves(x)
        # beats 0..3: they arrive (walking, handled by gait); from 4 on they dance with the hero
        tr.at('S7', 3.6, stand(x=x, fx=(0.2, 0.2), sh=(40, 40), el=(30, 30), fan=1.0, face=-self.side * 0.6), 'square')
        for b, p in moves:
            if b >= 4:
                tr.at('S7', b, dict(p, x=x), 'square')
        # while the hero spins they keep doing their step
        for i, b in enumerate(range(12, 16)):
            r = (i % 2 == 0)
            tr.at('S7', b, stand(x=x, fx=(0.12, 0.38) if r else (0.38, 0.12), sh=(40, 150) if r else (150, 40),
                                 el=(30, 10) if r else (10, 30), rot=-6 if r else 6, fan=1.0, py=-0.03), 'square')
        # S8: stop, stare, shake heads, leave
        look_at = -self.side * 0.7
        idle = stand(x=x, fx=(0.15, 0.15), sh=(12, 12), el=(-20, -20), fan=0.25, face=look_at, browTilt=-0.2, brow=0.4)
        tr.at('S8', 0.6, idle, 'square')
        for j, b in enumerate((1.0, 1.35, 1.7, 2.05)):
            tr.at('S8', b, F(idle, neck=14 * (-1) ** j, head=6 * (-1) ** j, browTilt=0.6, brow=-0.2), 'silly')
        tr.at('S8', 2.4, F(idle, face=self.side, browTilt=0.6), 'silly')
        return tr

    def pose(self, t):
        tt = t - self.toff * TL.S['S7'].spb
        if tt < self.t_in1:
            u = max(0.0, (tt - self.t_in0) / (self.t_in1 - self.t_in0))
            x = self.start + (self.home - self.start) * min(1.0, u)
            base = stand(x=x, fan=1.0, sh=(30, 30), el=(30, 30))
            p = apply_gait(base, self.L, abs(x - self.start), -self.side)
            p['x'] = x
            p['fan'] = 1.0
            return p
        if tt > self.t_out0:
            u = min(1.0, (tt - self.t_out0) / (self.t_out1 - self.t_out0))
            u = u * u * (3 - 2 * u) * 0.6 + u * 0.4
            x = self.home + (self.exit - self.home) * u
            base = stand(x=x, fan=0.25, sh=(10, 10), el=(-20, -20), browTilt=0.6)
            p = apply_gait(base, self.L, abs(x - self.home), self.side)
            p['x'] = x
            p['shL'] *= 0.5
            p['shR'] *= 0.5
            p['fan'] = 0.25
            return p
        return self.track.eval(tt)

    def visible(self, t):
        return TL.S['S7'].t(0) - 0.3 <= t <= self.t_out1


def aunties(hero_x):
    out = []
    for i in range(6):
        side = -1 if i < 3 else 1
        out.append(Auntie(i, side, hero_x))
    out.sort(key=lambda a: -a.depth)
    return out
