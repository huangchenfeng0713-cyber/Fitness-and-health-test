"""Camera: mostly a fixed medium shot, small push-ins on gags, a shake on the whistle.
Keys are (segment, beat) like everything else."""
import math

from .anim import smoother
from .timeline import TL, W, H

SCREEN_CY = 560.0

# (seg, beat, zoom, ground_screen_y)
_KEYS = [
    ('S1', -2, 2.15, 840), ('S1', 5.5, 2.15, 840), ('S1', 9.0, 1.85, 900), ('S1', 15.6, 1.65, 905),
    ('S2', 0.3, 1.45, 910), ('S2', 11.5, 1.45, 910), ('S2', 12.5, 1.62, 900), ('S2', 14, 1.62, 900),
    ('S2', 14.6, 1.42, 910),
    ('S3', -0.2, 1.42, 910), ('S3', 0.4, 1.0, 935), ('S3', 11.8, 1.0, 935), ('S3', 12.6, 1.14, 925),
    ('S3', 15.2, 1.14, 925), ('S3', 16.2, 1.0, 935), ('S3', 23.8, 1.0, 935),
    ('S4', 0.3, 1.16, 925), ('S4', 0.9, 1.16, 925), ('S4', 3.95, 1.42, 900), ('S4', 4.12, 1.12, 925),
    ('S4', 7.8, 1.12, 925),
    ('S5', 0.3, 1.06, 930), ('S5', 9.5, 1.06, 930), ('S5', 10.5, 1.0, 935), ('S5', 13.5, 1.0, 935),
    ('S5', 15.5, 1.2, 925),
    ('S6', 0.3, 1.2, 925), ('S6', 1.7, 1.2, 925), ('S6', 2.2, 1.42, 905), ('S6', 4.8, 1.42, 905),
    ('S6', 6.0, 1.2, 925), ('S6', 8.0, 1.2, 925), ('S6', 9.5, 1.1, 935), ('S6', 15.8, 1.1, 935),
    ('S7', 0.3, 0.94, 945), ('S7', 11.5, 0.94, 945), ('S7', 14, 1.04, 940),
    ('S8', 0.5, 1.02, 940), ('S8', 7.8, 1.02, 940), ('S8', 8.2, 1.1, 935), ('S8', 11.9, 1.1, 935),
    ('S8', 12.0, 1.36, 905), ('S8', 12.6, 1.08, 935), ('S8', 13.4, 1.08, 935), ('S8', 15.9, 1.22, 925),
    ('S9', 0.2, 1.1, 935), ('S9', 7.9, 1.1, 935),
    ('S10', -0.2, 1.1, 935), ('S10', 2.5, 1.15, 930), ('S10', 6.5, 1.55, 840),
]


def _keys():
    ks = []
    for seg, b, z, g in _KEYS:
        ks.append((TL.S[seg].t(b), z, g))
    ks.sort()
    ks.append((TL.t_morph, 1.55, 840))
    ks.append((TL.t_morph + 0.4, 2.15, 840))
    ks.append((TL.duration + 5, 2.15, 840))
    ks.sort()
    return ks


KEYS = _keys()


def zoom_ground(t):
    if t <= KEYS[0][0]:
        return KEYS[0][1], KEYS[0][2]
    for a, b in zip(KEYS, KEYS[1:]):
        if t < b[0]:
            u = smoother((t - a[0]) / max(b[0] - a[0], 1e-6))
            return a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u
    return KEYS[-1][1], KEYS[-1][2]


def shake(t):
    amp = 0.0
    for q in TL.find('mark', 'shake'):
        dt = t - q.t
        if 0 <= dt < 0.6:
            amp += 16 * math.exp(-dt / 0.15)
    S8 = TL.S['S8']
    for b in (8, 9, 10, 11):
        dt = t - S8.t(b)
        if 0 <= dt < 0.25:
            amp += 6 * math.exp(-dt / 0.06)
    if amp < 0.01:
        return 0.0, 0.0
    return amp * math.sin(t * 91.0), amp * 0.7 * math.cos(t * 77.0)


class Camera:
    def __init__(self, hero_x_fn):
        self.hero_x = hero_x_fn

    def at(self, t):
        z, g = zoom_ground(t)
        # follow the hero's x with a little lag
        cx = 0.0
        wsum = 0.0
        for k in range(7):
            dt = k * 0.06
            w = math.exp(-k * 0.5)
            cx += self.hero_x(t - dt) * w
            wsum += w
        cx /= wsum
        sx, sy = shake(t)
        return dict(zoom=z, ground=g, cx=cx, sx=sx, sy=sy)


def apply(ctx, cam, scale=1.0):
    """Set the cairo context to world coordinates (y up) for this camera."""
    z = cam['zoom']
    ctx.scale(scale, scale)
    ctx.translate(W / 2 + cam['sx'], cam['ground'] + cam['sy'])
    ctx.scale(z, -z)
    ctx.translate(-cam['cx'], 0)
