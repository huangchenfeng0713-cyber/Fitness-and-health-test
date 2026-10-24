"""Key-pose interpolation with the animation principles baked in.

* anticipation: every style's in-between curve backs off before it goes
* overshoot + settle: after a key is reached, a damped oscillation carries the
  joints a little past the target and back (proportional to the move size)
* weight first: root channels (pelvis / body) are sampled 1/8 beat ahead, so
  the pelvis arrives before the limbs, which arrive exactly on the beat
* beat bounce: the whole body sinks once per beat, lowest exactly on the beat
* style blend: per-style overlay parameters cross-fade over half a beat
* every style has its own curve, so the same puppet moves with a different
  "texture" (see STYLES)
"""
import bisect
import math
import random
from dataclasses import dataclass

from .skeleton import CHANNELS, DEFAULT, ROOT_CH, FOOT_CH, FACE_CH, LEFT_CH, RIGHT_CH
from .timeline import TL


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def smooth(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def smoother(u):
    u = clamp(u)
    return u * u * u * (u * (u * 6 - 15) + 10)


def ease_out(u, p=3):
    u = clamp(u)
    return 1 - (1 - u) ** p


def ease_in(u, p=2):
    return clamp(u) ** p


def in_out_back(u, s=1.2):
    """Anticipation (dips below 0) and overshoot (passes 1) inside the move."""
    u = clamp(u)
    s2 = s * 1.525
    if u < 0.5:
        return ((2 * u) ** 2 * ((s2 + 1) * 2 * u - s2)) / 2
    return ((2 * u - 2) ** 2 * ((s2 + 1) * (u * 2 - 2) + s2) + 2) / 2


def ease_out_back(u, s=1.7):
    u = clamp(u) - 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


def antic(u, a=0.12, split=0.28, out=lambda v: ease_out_back(v, 1.2)):
    """Anticipate (pull back by a) during the first `split` of the move, then go."""
    u = clamp(u)
    if u < split:
        return -a * (0.5 - 0.5 * math.cos(math.pi * u / split))
    v = (u - split) / (1 - split)
    return -a + (1 + a) * out(v)


def hold_then_snap(u, hold=0.45, p=4):
    """Broadcast-gymnastics: keep the last position, then a fast square move into the beat."""
    u = clamp(u)
    if u < hold:
        return 0.0
    v = (u - hold) / (1 - hold)
    return 1 - (1 - v) ** p


def step_curve(u, steps=3, start=0.25):
    """Robot: discrete clicks on the 16th-note grid; the last one lands exactly on the beat."""
    u = clamp(u)
    if u >= 1.0:
        return 1.0
    if u < start:
        return 0.0
    k = (u - start) / (1 - start) * steps
    i = math.floor(k)
    frac = k - i
    return (i + smooth((frac - 0.8) / 0.2)) / steps


def military(u):
    """Almost a step: 80 % hold, then a very short snap."""
    u = clamp(u)
    if u < 0.78:
        return 0.0
    return smooth((u - 0.78) / 0.22)


def sine(u):
    return 0.5 - 0.5 * math.cos(math.pi * clamp(u))


def heavy(u):
    """Office worker: slow, heavy ease-in, never quite gets going."""
    u = clamp(u)
    return smooth(u) ** 1.7


def bouncy(u):
    """Square dance: small dip, then a quick springy arrival with a big overshoot."""
    return antic(u, 0.08, 0.22, lambda v: ease_out_back(v, 2.2))


def kungfu(u):
    u = clamp(u)
    if u < 0.2:
        return -0.08 * math.sin(math.pi * u / 0.2)
    v = (u - 0.2) / 0.8
    return 1 - (1 - v) ** 5


@dataclass
class Style:
    name: str
    curve: callable
    foot: callable = smooth           # feet never overshoot (no sliding)
    settle_amp: float = 0.10          # overshoot after arrival, fraction of the move
    settle_freq: float = 1.6          # oscillations per beat
    settle_decay: float = 0.22        # beats
    bounce: float = 0.022             # beat bounce depth, fraction of leg length
    bounce_sharp: float = 2.0         # higher = shorter, punchier dip
    noise: float = 0.0                # deg of seeded wobble on limbs
    desync: float = 0.0               # beats: right side runs late / left side early
    jitter: float = 0.0               # deg of micro-vibration on arrival (robot)
    sway: float = 0.0                 # continuous hip sway (fraction of L)
    catmull: bool = False             # continuous arcs through the keys (tai chi)
    lead: float = 0.125               # pelvis leads the limbs by this many beats


STYLES = {
    'baby': Style('baby', lambda u: antic(u, 0.16, 0.3, lambda v: ease_out_back(v, 2.0)), settle_amp=0.16, settle_freq=1.3,
                  bounce=0.03, noise=7.0, desync=0.13),
    'silly': Style('silly', lambda u: in_out_back(u, 1.1), settle_amp=0.13, bounce=0.04,
                   noise=3.5, desync=0.08),
    'drill': Style('drill', hold_then_snap, foot=lambda u: hold_then_snap(u, 0.4, 3), settle_amp=0.05,
                   settle_freq=2.4, settle_decay=0.12, bounce=0.018, bounce_sharp=3.0),
    'military': Style('military', military, foot=military, settle_amp=0.03, settle_freq=3.0,
                      settle_decay=0.08, bounce=0.006, bounce_sharp=4.0, lead=0.06),
    'robot': Style('robot', step_curve, foot=lambda u: step_curve(u, 2, 0.5), settle_amp=0.0,
                   bounce=0.012, bounce_sharp=4.0, jitter=2.6, lead=0.0),
    'street': Style('street', sine, foot=sine, settle_amp=0.07, settle_freq=1.0, settle_decay=0.35,
                    bounce=0.05, bounce_sharp=1.2, sway=0.035),
    'office': Style('office', heavy, foot=heavy, settle_amp=-0.04, settle_freq=0.8, settle_decay=0.5,
                    bounce=0.01, bounce_sharp=1.0),
    'square': Style('square', bouncy, foot=smooth, settle_amp=0.12, settle_freq=2.0, settle_decay=0.18,
                    bounce=0.06, bounce_sharp=3.2),
    'taichi': Style('taichi', sine, foot=smoother, settle_amp=0.0, bounce=0.012, bounce_sharp=0.8,
                    catmull=True, lead=0.18),
    'kungfu': Style('kungfu', kungfu, foot=lambda u: ease_out(u, 4), settle_amp=0.15, settle_freq=2.2,
                    settle_decay=0.15, bounce=0.03, bounce_sharp=3.0),
    'spin': Style('spin', sine, foot=lambda u: clamp(u), settle_amp=0.0, bounce=0.03, bounce_sharp=1.5),
    'glide': Style('glide', lambda u: clamp(u), foot=lambda u: clamp(u), settle_amp=0.0, bounce=0.02,
                   bounce_sharp=2.0, lead=0.0),
    'still': Style('still', smoother, foot=smoother, settle_amp=0.0, bounce=0.0, lead=0.0),
    'slow': Style('slow', smoother, foot=smoother, settle_amp=0.0, bounce=0.0, catmull=True, lead=0.1),
}


@dataclass
class Key:
    t: float
    pose: dict
    style: str
    seg: str = ''
    beat: float = 0.0
    note: str = ''


class Track:
    """A list of key poses on the timeline.  Keys are added by (segment, beat)."""

    def __init__(self, seed=1):
        self.keys = []
        self.seed = seed
        rnd = random.Random(seed)
        self._noise = {c: [(rnd.uniform(0.6, 1.6), rnd.uniform(0, 6.28), rnd.uniform(1.7, 2.9), rnd.uniform(0, 6.28))
                           for _ in range(1)] for c in CHANNELS}
        self._dirty = True

    # ---- authoring
    def at(self, seg, beat, pose, style, note=''):
        s = TL.S[seg]
        self.keys.append(Key(s.t(beat), dict(pose), style, seg, beat, note))
        self._dirty = True
        return self

    def at_t(self, t, pose, style, note=''):
        self.keys.append(Key(t, dict(pose), style, '', 0.0, note))
        self._dirty = True
        return self

    def _prep(self):
        if self._dirty:
            self.keys.sort(key=lambda k: k.t)
            self._times = [k.t for k in self.keys]
            # a spin of exactly n*360 between two keys is no spin at all (the turn is done)
            for a, b in zip(self.keys, self.keys[1:]):
                d = b.pose['spin'] - a.pose['spin']
                if abs(d) > 1e-6 and abs(math.remainder(d, 360.0)) < 1e-6:
                    b.pose['spin'] = a.pose['spin']
            self._dirty = False

    # ---- evaluation helpers
    def _idx(self, t):
        return bisect.bisect_right(self._times, t)

    def style_at(self, t):
        self._prep()
        i = self._idx(t)
        if i >= len(self.keys):
            return self.keys[-1].style
        return self.keys[i].style if i > 0 else self.keys[0].style

    def overlay(self, t):
        """Blended overlay parameters (bounce, noise, ...) with a half-beat cross-fade."""
        self._prep()
        i = self._idx(t)
        n = len(self.keys)
        cur = self.keys[min(max(i, 1), n - 1)].style
        # find where the current style run started
        j = min(max(i, 1), n - 1)
        while j > 1 and self.keys[j - 1].style == cur:
            j -= 1
        prev = self.keys[j - 1].style if j >= 1 else cur
        t_sw = self.keys[j - 1].t
        _, b = TL.beat_info(t)
        half = 0.5 * TL.seg_at(t).beat_len(b)
        w = smooth((t - t_sw) / max(half, 1e-3)) if prev != cur else 1.0
        A, B = STYLES[prev], STYLES[cur]
        out = {}
        for f in ('bounce', 'bounce_sharp', 'noise', 'desync', 'jitter', 'sway', 'lead'):
            out[f] = getattr(A, f) + (getattr(B, f) - getattr(A, f)) * w
        return out

    def _interp(self, t, chans, foot=False):
        self._prep()
        keys = self.keys
        n = len(keys)
        i = self._idx(t)
        res = {}
        if i <= 0:
            for c in chans:
                res[c] = keys[0].pose[c]
            return res, None
        if i >= n:
            k = keys[-1]
            for c in chans:
                res[c] = k.pose[c]
            u_settle = t - k.t
            self._add_settle(res, chans, n - 1, t, foot)
            return res, None
        A, B = keys[i - 1], keys[i]
        st = STYLES[B.style]
        dt = B.t - A.t
        u = (t - A.t) / dt if dt > 1e-9 else 1.0
        if foot:
            e = st.foot(u)
            for c in chans:
                res[c] = A.pose[c] + (B.pose[c] - A.pose[c]) * e
            return res, (A, B, e)
        if st.catmull:
            P0 = keys[i - 2].pose if i >= 2 else A.pose
            P3 = keys[i + 1].pose if i + 1 < n else B.pose
            t0 = keys[i - 2].t if i >= 2 else A.t - dt
            t3 = keys[i + 1].t if i + 1 < n else B.t + dt
            e = sine(u) * 0.35 + u * 0.65            # gentle sinusoidal easing along the arc
            for c in chans:
                p0, p1, p2, p3 = P0[c], A.pose[c], B.pose[c], P3[c]
                # non-uniform Catmull-Rom tangents (keys are not evenly spaced in time)
                m1 = (p2 - p0) / max(B.t - t0, 1e-6) * dt
                m2 = (p3 - p1) / max(t3 - A.t, 1e-6) * dt
                e2, e3 = e * e, e * e * e
                res[c] = ((2 * e3 - 3 * e2 + 1) * p1 + (e3 - 2 * e2 + e) * m1 +
                          (-2 * e3 + 3 * e2) * p2 + (e3 - e2) * m2)
        else:
            e = st.curve(u)
            for c in chans:
                res[c] = A.pose[c] + (B.pose[c] - A.pose[c]) * e
        self._add_settle(res, chans, i - 1, t, foot)
        return res, (A, B, e)

    def _add_settle(self, res, chans, j, t, foot):
        """Overshoot after arrival: damped oscillation in the direction of the last move."""
        if foot or j < 1:
            return
        keys = self.keys
        for jj in (j, j - 1):
            if jj < 1:
                break
            K, P = keys[jj], keys[jj - 1]
            st = STYLES[K.style]
            if st.settle_amp == 0 and st.jitter == 0:
                continue
            seg, b = TL.beat_info(K.t)
            bl = seg.beat_len(b)
            tau = (t - K.t) / bl
            if tau < 0 or tau > 1.6:
                continue
            osc = st.settle_amp * math.sin(2 * math.pi * st.settle_freq * tau) * math.exp(-tau / st.settle_decay)
            jit = 0.0
            if st.jitter:
                ts = t - K.t
                jit = st.jitter * math.sin(2 * math.pi * 23 * ts) * math.exp(-ts / 0.07)
            for c in chans:
                d = K.pose[c] - P.pose[c]
                if d != 0:
                    res[c] += d * osc
                    if jit and c in ('shL', 'shR', 'elL', 'elR', 'spine', 'neck', 'head'):
                        res[c] += jit * (1 if d > 0 else -1)

    # ---- the full evaluation
    def eval(self, t, bounce_on=True):
        self._prep()
        ov = self.overlay(t)
        seg, b = TL.beat_info(t)
        bl = seg.beat_len(b)
        pose = dict(DEFAULT)
        # root leads by 1/8 beat
        r, _ = self._interp(t + ov['lead'] * bl, ROOT_CH)
        pose.update(r)
        # feet: no anticipation / overshoot, plus automatic step arcs
        f, info = self._interp(t, FOOT_CH, foot=True)
        pose.update(f)
        if info is not None:
            A, B, e = info
            if not (B.pose['glide'] > 0.5 and A.pose['glide'] > 0.5):
                for side in 'LR':
                    dx = B.pose['f%sx' % side] - A.pose['f%sx' % side]
                    pl = min(A.pose['plant' + side], B.pose['plant' + side])
                    if pl > 0.5 and abs(dx) > 0.015:
                        lift = clamp(abs(dx) * 0.55, 0.035, 0.16)
                        pose['f%sy' % side] += lift * math.sin(math.pi * clamp(e))
        # face channels: plain smooth interpolation
        fc, _ = self._interp(t, FACE_CH, foot=True)
        pose.update(fc)
        # limbs, with left/right desync
        mid = [c for c in CHANNELS if c not in ROOT_CH + FOOT_CH + FACE_CH]
        d = ov['desync'] * bl
        if d:
            lres, _ = self._interp(t + d * 0.5, LEFT_CH)
            rres, _ = self._interp(t - d * 0.5, RIGHT_CH)
            other = [c for c in mid if c not in LEFT_CH + RIGHT_CH]
            ores, _ = self._interp(t, other)
            pose.update(lres)
            pose.update(rres)
            pose.update(ores)
        else:
            m, _ = self._interp(t, mid)
            pose.update(m)
        # seeded wobble
        if ov['noise'] > 0.05:
            for c in ('shL', 'shR', 'elL', 'elR', 'spine', 'neck', 'head'):
                (f1, p1, f2, p2), = self._noise[c]
                pose[c] += ov['noise'] * (0.6 * math.sin(t * f1 * 2 * math.pi * 0.9 + p1) +
                                          0.4 * math.sin(t * f2 * 2 * math.pi * 0.9 + p2))
        # hip sway (street)
        if ov['sway'] > 0.001:
            ph = b * math.pi          # one full sway every two beats
            pose['px'] += ov['sway'] * math.sin(ph)
        # beat bounce: lowest exactly on the beat, stronger on 1 and 5.  Depth/shape are taken
        # from the nearest beat so the dip stays symmetric even while styles cross-fade.
        if bounce_on and t >= seg.t0 and pose['sit'] < 0.9:
            bn = math.floor(b + 0.5)
            ovb = self.overlay(seg.t(bn)) if abs(seg.t(bn) - t) > 1e-9 else ov
            if ovb['bounce'] > 0:
                frac = b - math.floor(b)
                k = int(bn) % 8
                acc = 1.45 if k in (0, 4) else 1.0
                dip = (0.5 + 0.5 * math.cos(2 * math.pi * frac)) ** ovb['bounce_sharp']
                pose['py'] -= ovb['bounce'] * acc * dip
        return pose
