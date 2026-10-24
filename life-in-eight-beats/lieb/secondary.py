"""Secondary motion: spring-damper simulation of the dangly bits.

Red scarf tails, tie, badge, hoodie strings, white hair tufts, goatee, the fans and the
belly all lag behind the body and keep wobbling after the body stops.  The whole film
is simulated once at 240 Hz (it is a sequential process, frames can't be rendered
independently otherwise) and cached per frame.
"""
import math
import numpy as np

from .skeleton import solve, rot, add, sub
from .timeline import TL, FPS

DT = 1.0 / 240.0

# name: (frequency Hz, damping ratio, length clamp)
POINT_SPRINGS = {
    'scarfL': (2.4, 0.22, True), 'scarfR': (2.6, 0.22, True),
    'tie': (2.0, 0.25, True), 'badge': (1.8, 0.2, True),
    'strL': (3.0, 0.2, True), 'strR': (3.2, 0.2, True),
    'hairL': (3.2, 0.18, True), 'hairR': (3.0, 0.18, True), 'hairT': (4.0, 0.2, True),
    'beard': (3.4, 0.2, True),
}


def _targets(rig):
    """anchor and rest tip (world) for every point spring."""
    pr = rig.pr
    tw = pr['torso_w']
    r = pr['head_r']
    ch = rig.chest
    tang = rig.body_ang
    ha = rig.head_ang
    out = {}
    knot = add(ch, (0, -tw * 0.08))
    for key, j in (('scarfL', -1), ('scarfR', 1)):
        out[key] = (knot, add(knot, rot((j * tw * 0.12, -tw * 0.85), tang * 0.6)))
    k2 = add(ch, (0, -tw * 0.18))
    out['tie'] = (k2, add(k2, rot((0, -tw * 1.6), tang * 0.85)))
    b = add(ch, (tw * 0.18, -tw * 0.1))
    out['badge'] = (b, add(b, rot((tw * 0.08, -tw * 1.3), tang * 0.5)))
    for key, j in (('strL', -1), ('strR', 1)):
        a = add(ch, (j * tw * 0.16, -tw * 0.12))
        out[key] = (a, add(a, rot((0, -tw * 0.9), tang * 0.7)))
    head = rig.head
    for key, loc_anchor, loc_rest in (('hairL', (-r * 0.9, r * 0.12), (-r * 0.5, -r * 0.18)),
                                      ('hairR', (r * 0.9, r * 0.12), (r * 0.5, -r * 0.18)),
                                      ('hairT', (0, r * 0.97), (r * 0.12, r * 0.42)),
                                      ('beard', (0, -r * 0.62), (0, -r * 0.42))):
        a = add(head, rot(loc_anchor, ha))
        # hair hangs partly with the head, partly with gravity
        rest = rot(loc_rest, ha * 0.7)
        out[key] = (a, add(a, rest))
    return out


def wind(t):
    """Wind gusts: the tai chi freeze (white hair flying) and into the flashback."""
    S8, S9 = TL.S['S8'], TL.S['S9']
    w0, w1 = S8.t(13.5), S9.t(1.0)
    if t < w0 or t > w1:
        return (0.0, 0.0)
    u = (t - w0) / (w1 - w0)
    env = math.sin(math.pi * min(1.0, u * 1.3)) if u < 0.77 else max(0.0, 1 - (u - 0.77) / 0.23)
    g = 0.65 + 0.35 * math.sin(t * 7.3) * math.sin(t * 2.1 + 1)
    return (900.0 * env * g, 160.0 * env * math.sin(t * 5.0))


class Secondary:
    def __init__(self, track, props_fn, home_x=0.0, t0=0.0, t1=None, wind_on=True):
        if t1 is None:
            t1 = TL.duration
        self.t0, self.t1 = t0, t1
        n_frames = int(math.ceil((t1 - t0) * FPS)) + 2
        names = list(POINT_SPRINGS)
        self.names = names
        off = np.zeros((n_frames, len(names), 2))
        fan = np.zeros((n_frames, 2))
        belly = np.zeros(n_frames)
        hang = np.zeros((n_frames, len(names)))      # head angle when sampled (for head-local conversion)

        def state(t):
            p = track.eval(t)
            rig = solve(p, props_fn(t), home_x)
            return rig

        rig = state(t0)
        tg = _targets(rig)
        pos = {k: np.array(tg[k][1], float) for k in names}
        vel = {k: np.zeros(2) for k in names}
        prev_anchor = {k: np.array(tg[k][0], float) for k in names}
        fan_th = np.zeros(2)
        fan_w = np.zeros(2)
        prev_hand = np.array([rig.hand_angL, rig.hand_angR])
        prev_hand_v = np.zeros(2)
        prev_wr = np.array([rig.wrL, rig.wrR], float)
        prev_wr_v = np.zeros((2, 2))
        b_y, b_v = 0.0, 0.0
        prev_py = rig.pelvis[1]
        prev_pv = 0.0
        steps_per_frame = int(round(1.0 / (DT * FPS)))   # 8
        t = t0
        fi = 0
        nsteps = (n_frames - 1) * steps_per_frame
        for s in range(nsteps + 1):
            if s % steps_per_frame == 0:
                for i, k in enumerate(names):
                    off[fi, i] = pos[k] - prev_anchor[k]
                    hang[fi, i] = rig.head_ang
                fan[fi] = fan_th
                belly[fi] = b_y
                fi += 1
                if fi >= n_frames:
                    break
            t += DT
            # re-solve at 120 Hz, interpolate anchors in between (cheap and plenty smooth)
            if s % 2 == 0:
                rig = state(t)
                tg = _targets(rig)
            wx, wy = wind(t) if wind_on else (0.0, 0.0)
            for k in names:
                f, z, clamp_len = POINT_SPRINGS[k]
                kk = (2 * math.pi * f) ** 2
                cc = 2 * z * math.sqrt(kk)
                a = np.array(tg[k][0], float)
                target = np.array(tg[k][1], float)
                rest_len = float(np.hypot(*(target - a)))
                va = (a - prev_anchor[k]) / DT
                acc = kk * (target - pos[k]) - cc * (vel[k] - va)
                if k.startswith('hair') or k == 'beard':
                    acc = acc + np.array([wx, wy])
                elif k.startswith('scarf') or k == 'tie':
                    acc = acc + np.array([wx, wy]) * 0.3
                vel[k] = vel[k] + acc * DT
                pos[k] = pos[k] + vel[k] * DT
                if clamp_len and rest_len > 1e-3:
                    d = pos[k] - a
                    L = float(np.hypot(*d))
                    lo, hi = rest_len * 0.75, rest_len * 1.08
                    if L > hi or L < lo:
                        pos[k] = a + d / max(L, 1e-6) * min(max(L, lo), hi)
                prev_anchor[k] = a
            if s % 2 != 0:
                continue
            # --- 120 Hz part: fans and belly (driven by derivatives of the solved rig)
            dt2 = 2 * DT
            # fans: rigid fan on a compliant wrist; lags the hand's rotation and its sideways acceleration
            hand = np.array([rig.hand_angL, rig.hand_angR])
            hv = (hand - prev_hand) / dt2
            ha_ = (hv - prev_hand_v) / dt2
            wr = np.array([rig.wrL, rig.wrR], float)
            wv = (wr - prev_wr) / dt2
            wa = (wv - prev_wr_v) / dt2
            kk = (2 * math.pi * 3.0) ** 2
            cc = 2 * 0.22 * math.sqrt(kk)
            for j in range(2):
                ang = math.radians(hand[j])
                d = (math.sin(ang), -math.cos(ang))
                lat = wa[j][0] * d[1] - wa[j][1] * d[0]           # px/s^2 across the fan
                drive = -ha_[j] - math.degrees(lat / 55.0)
                drive = max(-60000.0, min(60000.0, drive))
                fan_w[j] += (-kk * fan_th[j] - cc * fan_w[j] + drive) * dt2
                fan_th[j] += fan_w[j] * dt2
            fan_th = np.clip(fan_th, -30, 30)
            prev_hand, prev_hand_v = hand, hv
            prev_wr, prev_wr_v = wr, wv
            # belly: vertical jiggle driven by pelvis acceleration
            py = rig.pelvis[1]
            pv = (py - prev_py) / dt2
            pa = (pv - prev_pv) / dt2
            kk = (2 * math.pi * 4.0) ** 2
            cc = 2 * 0.14 * math.sqrt(kk)
            b_v += (-kk * b_y - cc * b_v - pa) * dt2
            b_y += b_v * dt2
            b_y = max(-12.0, min(12.0, b_y))
            prev_py, prev_pv = py, pv
        self.off, self.fan, self.belly, self.hang = off[:fi], fan[:fi], belly[:fi], hang[:fi]

    def get(self, t, head_ang=None):
        """Spring state at time t (nearest frame).  Head springs are returned head-local."""
        i = int(round((t - self.t0) * FPS))
        i = max(0, min(len(self.off) - 1, i))
        out = {}
        for j, k in enumerate(self.names):
            o = self.off[i, j]
            if k.startswith('hair') or k == 'beard':
                ha = head_ang if head_ang is not None else self.hang[i, j]
                o = rot((float(o[0]), float(o[1])), -ha)
            else:
                o = (float(o[0]), float(o[1]))
            out[k] = o
        out['fanL'] = float(self.fan[i, 0])
        out['fanR'] = float(self.fan[i, 1])
        out['belly'] = float(self.belly[i])
        return out

    def save(self, path):
        np.savez_compressed(path, off=self.off, fan=self.fan, belly=self.belly, hang=self.hang,
                            t0=self.t0, t1=self.t1, names=np.array(self.names))

    @classmethod
    def load(cls, path):
        d = np.load(path)
        obj = cls.__new__(cls)
        obj.off, obj.fan, obj.belly, obj.hang = d['off'], d['fan'], d['belly'], d['hang']
        obj.t0, obj.t1 = float(d['t0']), float(d['t1'])
        obj.names = [str(x) for x in d['names']]
        return obj
