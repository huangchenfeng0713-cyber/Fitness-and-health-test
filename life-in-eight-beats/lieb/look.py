"""What the hero looks like at time t: proportions (continuously blended) and costume
(switched on the downbeat under a "噗" puff).  All switch times come from the timeline's
puff cues."""
from .skeleton import PROPS, mix_props
from .anim import smoother
from .timeline import TL


def _switches():
    sw = [(-10.0, 'baby', 0.0, 0.0)]
    for q in TL.find('puff'):
        seg = TL.seg_at(q.t)
        bl = seg.beat_len(seg.beat_at(q.t))
        if q.data.get('quiet'):
            pre, post = 0.0, 0.3
        elif q.data.get('small'):
            pre, post = 0.08 * bl, 0.35 * bl
        else:
            pre, post = 0.15 * bl, 0.75 * bl
        sw.append((q.t, q.name, pre, post))
    sw.sort(key=lambda s: s[0])
    return sw


SWITCHES = _switches()


def hero_costume(t):
    c = SWITCHES[0][1]
    for ts, name, _, _ in SWITCHES:
        if t >= ts:
            c = name
    return c


def hero_props(t):
    pr = PROPS[SWITCHES[0][1]]
    for i in range(1, len(SWITCHES)):
        ts, name, pre, post = SWITCHES[i]
        prev = SWITCHES[i - 1][1]
        if t < ts - pre:
            break
        u = smoother((t - (ts - pre)) / max(pre + post, 1e-6))
        pr = mix_props(PROPS[prev], PROPS[name], u)
    return pr
