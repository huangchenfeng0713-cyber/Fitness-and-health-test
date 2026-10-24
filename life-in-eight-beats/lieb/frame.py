"""Compose one frame: background stage(s), crowd, hero, effects, title card."""
import hashlib
import math
import os

import cairo

from . import camera as C
from . import scenes as SC
from . import effects as FX
from .choreo import build
from .crowd import pupils_layout, aunties
from .draw import draw_character, Look, COSTUMES, hexc
from .look import hero_props, hero_costume
from .secondary import Secondary
from .skeleton import solve, PROPS
from .timeline import TL, W, H

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, 'out', 'cache')


def _src_hash():
    h = hashlib.sha1()
    for fn in sorted(os.listdir(HERE)):
        if fn.endswith('.py'):
            with open(os.path.join(HERE, fn), 'rb') as f:
                h.update(f.read())
    return h.hexdigest()[:12]


class Film:
    def __init__(self, verbose=False):
        tr = build()
        self.hero = tr['hero']
        self.pupils = tr['pupils']
        self.hero_x_end = tr['x_after_moonwalk']
        self.cam = C.Camera(lambda t: self.hero.eval(t, bounce_on=False)['x'])
        self.layout = pupils_layout()
        self.aunties = aunties(self.hero_x_end)
        os.makedirs(CACHE, exist_ok=True)
        tag = _src_hash()
        self.sec_hero = self._sec('hero_' + tag, lambda: Secondary(self.hero, hero_props, verbose and 0))
        S3, S4 = TL.S['S3'], TL.S['S4']
        self.sec_pupils = self._sec('pupils_' + tag, lambda: Secondary(
            self.pupils, lambda t: PROPS['school'], 0.0, S3.t0 - 1.0, S4.t(1.5), wind_on=False))

    def _sec(self, name, make):
        path = os.path.join(CACHE, name + '.npz')
        if os.path.exists(path):
            return Secondary.load(path)
        s = make()
        s.save(path)
        return s

    # ------------------------------------------------------------------
    def hero_state(self, t):
        p = self.hero.eval(t)
        FX.mouth_on_counts(p, t)
        pr = hero_props(t)
        rig = solve(p, pr, 0.0)
        sec = self.sec_hero.get(t, rig.head_ang)
        return rig, Look(hero_costume(t), sec)

    def render(self, t, scale=1.0, surface=None):
        w, h = int(round(W * scale)), int(round(H * scale))
        surf = surface or cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
        ctx = cairo.Context(surf)
        ctx.set_antialias(cairo.ANTIALIAS_GOOD)
        if t >= TL.t_black:
            SC.title_card(ctx, t, scale)
            return surf
        cam = self.cam.at(t)
        rig, look = self.hero_state(t)
        # background (screen space + world space), crowd, hero, effects
        ctx.save()
        SC.background(ctx, t, cam, scale, rig)
        ctx.restore()
        ctx.save()
        C.apply(ctx, cam, scale)
        SC.world_back(ctx, t, cam, rig)
        self._crowd(ctx, t)
        SC.world_mid(ctx, t, cam, rig)
        draw_character(ctx, rig, look, t)
        SC.world_front(ctx, t, cam, rig)
        FX.world_effects(ctx, t, rig, cam)
        ctx.restore()
        ctx.save()
        FX.screen_effects(ctx, t, scale, rig, cam)
        ctx.restore()
        return surf

    def _crowd(self, ctx, t):
        S3 = TL.S['S3']
        vis = SC.stage_weight(t, 'school')
        if vis > 0.01 and S3.t0 - 1 <= t <= TL.S['S4'].t(1.5):
            for dx, dy, sc, toff in self.layout:
                tt = t - toff * S3.spb
                p = self.pupils.eval(tt)
                rig = solve(p, PROPS['school'], 0.0)
                sec = self.sec_pupils.get(tt, rig.head_ang)
                ctx.save()
                ctx.translate(dx, dy)
                ctx.scale(sc, sc)
                SC.crowd_fade(ctx, vis)
                draw_character(ctx, rig, Look('pupil', sec), tt)
                SC.crowd_fade_end(ctx, vis)
                ctx.restore()
        for a in self.aunties:
            if not a.visible(t):
                continue
            p = a.pose(t)
            rig = solve(p, PROPS['auntie'], 0.0)
            c = dict(COSTUMES['auntie'])
            c['top'] = c['sleeve'] = hexc(a.top)
            c['haircol'] = hexc(a.hair)
            ctx.save()
            ctx.translate(0, a.depth)
            ctx.translate(rig.anchor[0], 0)
            ctx.scale(a.scale, a.scale)
            ctx.translate(-rig.anchor[0], 0)
            draw_character(ctx, rig, Look(c, {}), t)
            ctx.restore()
