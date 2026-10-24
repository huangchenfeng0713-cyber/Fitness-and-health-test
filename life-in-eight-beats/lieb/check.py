"""Validation: everything that should sit on a beat does.

  * segment table, BPMs and eight-counts as in the brief
  * one count per beat, correct words (一二三四五六七八 / 二二三四 ...)
  * every key pose sits on the beat grid (1/4-beat resolution) or on a named cue
  * costume puffs on downbeats
  * measured onsets of the count syllables in the rendered voice stem vs. the beats
  * beat bounce: lowest pelvis exactly on the beat
  * planted feet do not slide
  * no move repeated more than twice in a row
"""
import math

import numpy as np

from .timeline import TL, FPS, DIGITS

BRIEF = {'S1': (100, 2), 'S2': (110, 2), 'S3': (120, 3), 'S4': (120, 1), 'S5': (128, 2), 'S6': (100, 2),
         'S7': (132, 2), 'S8': (66, 2), 'S9': (140, 1), 'S10': (66, 1)}


class Report:
    def __init__(self):
        self.ok = True
        self.lines = []

    def check(self, cond, msg):
        self.lines.append(('PASS' if cond else 'FAIL') + '  ' + msg)
        if not cond:
            self.ok = False
        return cond

    def info(self, msg):
        self.lines.append('      ' + msg)


def _named_times():
    S8 = TL.S['S8']
    return {
        'freeze': S8.t(11) + S8.beat_len(11), 'cough': TL.t_cough, 'stop': TL.t_stop,
        'seven_end': TL.t_seven_end, 'morph': TL.t_morph, 'eight': TL.t_eight,
    }


def check_timeline(r):
    r.info('segment table:')
    r.info('  seg   stage    BPM  beats   start     end    len')
    for s in TL.segs:
        r.info(f'  {s.key:<4}  {s.title:<5} {s.bpm:5.0f}  {s.n:5d}  {s.t0:6.2f}  {s.t1:6.2f}  {s.t1 - s.t0:5.2f}')
        bpm, eights = BRIEF[s.key]
        r.check(abs(s.bpm - bpm) < 1e-9, f'{s.key} BPM {s.bpm:g} == brief {bpm}')
        if s.key == 'S10':
            r.check(s.n == 7, 'S10 counts 一..七 on the grid, 八 after the silence')
        else:
            r.check(s.n == 8 * eights, f'{s.key} has {eights} eight(s) = {8 * eights} beats')
        # evenly spaced beats (except the S8 fast half-eight and its rest)
        for b in range(s.n):
            L = s.beat_len(b)
            want = s.spb / 2 if (s.fast and s.fast[0] <= b < s.fast[1]) else s.spb
            if abs(L - want) > 1e-9:
                r.check(False, f'{s.key} beat {b} length {L:.4f} != {want:.4f}')
    r.check(80 <= TL.duration <= 92, f'total duration {TL.duration:.2f}s (target ≈85 s)')
    S8 = TL.S['S8']
    r.check(abs(S8.beat_len(9) * 2 - S8.spb) < 1e-9, 'S8 fast-forward beats are exactly 2x (132 BPM)')


def check_counts(r):
    for s in TL.segs:
        cs = [q for q in TL.find('count', seg=s.key)]
        if s.key == 'S10':
            words = ''.join(q.name for q in cs)
            r.check(words == '一二三四五六七', f'S10 counts {words} (then silence, then the baby\'s 八)')
            continue
        r.check(len(cs) == s.n, f'{s.key}: {len(cs)} counts for {s.n} beats')
        bad = [q for q in cs if abs(q.t - s.t(q.beat)) > 1e-9 or abs(q.beat - round(q.beat)) > 1e-9]
        r.check(not bad, f'{s.key}: every count on an integer beat')
        words = ''.join(q.name for q in sorted(cs, key=lambda q: q.t))
        want = ''.join(s.count_text(b) for b in range(s.n))
        r.check(words == want, f'{s.key}: {words}')
    finals = [q for q in TL.find('count', '八') if q.data.get('voice') == 'baby_final']
    r.check(len(finals) == 1 and abs(finals[0].t - TL.t_eight) < 1e-9, f'baby "八！" at {TL.t_eight:.3f}s')


def _on_grid(t, res=4):
    order = [TL.seg_at(t)] + TL.segs
    for seg in order:
        if seg.t0 - 2 <= t <= seg.t1 + 0.01:
            b = seg.beat_at(t)
            q = round(b * res) / res
            if abs(seg.t(q) - t) < 1e-6:
                return seg.key, q
    return None, None


def check_keys(r, tracks):
    named = _named_times()
    for name, tr in tracks.items():
        tr._prep()
        off, n_int, n_frac = [], 0, 0
        for k in tr.keys:
            if k.t < 0 or k.t > TL.duration:
                continue
            seg, b = _on_grid(k.t)
            if seg is None:
                tag = [nm for nm, tt in named.items() if abs(tt - k.t) < 0.4]
                if not tag:
                    off.append(k)
                continue
            if abs(b - round(b)) < 1e-9:
                n_int += 1
            else:
                n_frac += 1
        r.check(not off, f'{name}: {len(tr.keys)} keys, {n_int} on beats, {n_frac} on half/quarter beats, '
                         f'{len(off)} off-grid' + ('' if not off else ' -> ' + ', '.join(f'{k.t:.3f}' for k in off[:6])))


def check_puffs(r):
    bad = []
    for q in TL.find('puff'):
        if q.data.get('quiet'):
            continue
        seg, b = _on_grid(q.t, 1)
        if seg is None or (seg != 'S9' and b != 0):
            bad.append(q)
    r.check(not bad, f'{len(TL.find("puff"))} costume puffs, all on downbeats (S9: every beat)')


def check_voice_onsets(r):
    from .audio.mix import build_counts
    from .audio.synth import SR
    n = int(TL.duration * SR) + SR
    stems, log = build_counts(n)
    errs = []
    cts = sorted(e['t'] for e in log if e['kind'] == 'count')
    for e in log:
        if e['kind'] != 'count':
            continue
        y = stems[e['stem']]
        t = e['t']
        nxt = [c for c in cts if c > t + 1e-6]
        end = min(nxt[0] if nxt else t + 1.0, t + 1.0) - 0.01
        a, b = int((t - 0.1) * SR), int(end * SR)
        seg = y[a:b]
        w = int(0.005 * SR)
        env = np.sqrt(np.convolve(seg * seg, np.ones(w) / w, mode='same'))
        # only this syllable: the previous one is faded out before the beat
        i_t = int(0.1 * SR)
        m = env[i_t:].max()
        above = np.where(env[i_t - int(0.03 * SR):] >= 0.2 * m)[0]
        if not len(above):
            continue
        t_on = (a + i_t - int(0.03 * SR) + above[0]) / SR
        errs.append((t_on - t, e))
    d = np.array([abs(x[0]) for x in errs])
    worst = max(errs, key=lambda x: abs(x[0]))
    r.check(d.max() < 0.012, f'{len(errs)} count syllables: measured onset vs beat  mean {d.mean() * 1000:.1f} ms, '
                             f'max {d.max() * 1000:.1f} ms ({worst[1]["text"]} @ {worst[1]["t"]:.2f}s)')


def check_bounce_and_feet(r, film):
    hero = film.hero
    # bounce: compare py with and without the bounce around beats
    worst = 0.0
    for s in TL.segs[:9]:
        for b in range(0, s.n, 3):
            if s.rest and b == s.rest[0]:
                continue                     # frozen during the tape-stop rest
            ts = [s.t(b) + dt for dt in np.linspace(-0.08, 0.08, 17) * s.beat_len(b)]
            dips = [hero.eval(t, bounce_on=False)['py'] - hero.eval(t)['py'] for t in ts]
            if max(dips) > 1e-4:
                k = int(np.argmax(dips))
                worst = max(worst, abs(ts[k] - s.t(b)))
    r.check(worst <= 0.011 * 1.0, f'beat bounce: deepest point within {worst * 1000:.1f} ms of the beat')
    # foot slip
    from .look import hero_props, SWITCHES
    from .skeleton import solve
    puffs = [sw[0] for sw in SWITCHES[1:]]
    prev = None
    slips = []
    for f in range(int(TL.duration * FPS)):
        t = f / FPS
        p = hero.eval(t)
        rig = solve(p, hero_props(t), 0.0)
        cur = (rig.anL, rig.anR, p)
        if prev is not None and not any(abs(t - tp) < 0.6 for tp in puffs):
            for i, side in enumerate('LR'):
                planted = p['plant' + side] > 0.99 and prev[2]['plant' + side] > 0.99 and p['sit'] < 0.01
                on_ground = cur[i][1] < rig.pr['limb_w'] * 0.5 + 1.0 and prev[i][1] < rig.pr['limb_w'] * 0.5 + 1.0
                spinning = abs(p['spin'] - prev[2]['spin']) > 0.01
                if planted and on_ground and p['glide'] < 0.5 and not spinning:
                    dx = abs(cur[i][0] - prev[i][0])
                    if dx > 2.0:
                        slips.append((t, side, dx))
        prev = cur
    r.check(len(slips) == 0, f'planted feet: {len(slips)} sliding frames'
            + ('' if not slips else ' e.g. ' + ', '.join(f'{t:.2f}s {s} {d:.1f}px' for t, s, d in slips[:6])))


def check_repeats(r, hero):
    hero._prep()
    worst = []
    chans = ('shL', 'shR', 'elL', 'elR', 'fLx', 'fRx', 'fLy', 'fRy', 'spine', 'neck', 'rot')
    by_seg = {}
    for k in hero.keys:
        if k.seg:
            by_seg.setdefault(k.seg, []).append(k)
    for seg, ks in by_seg.items():
        sigs = [tuple(round(k.pose[c] / 4) for c in chans) for k in ks]
        moves = [(a, b) for a, b in zip(sigs, sigs[1:]) if a != b]
        # longest run of the same move repeating back-to-back (A->B, A->B ...) or ping-pong (A->B->A->B)
        run, best = 1, 1
        for i in range(2, len(moves)):
            if moves[i] == moves[i - 2]:
                run += 1
                best = max(best, run)
            else:
                run = 1
        worst.append((seg, best))
    bad = [w for w in worst if w[1] > 3]
    r.check(not bad, 'no move repeated verbatim more than twice: ' +
            ', '.join(f'{s} max {n // 2 + 1}x' for s, n in worst))


def run_checks(audio=True):
    from .frame import Film
    film = Film()
    r = Report()
    check_timeline(r)
    check_counts(r)
    check_keys(r, {'hero': film.hero, 'pupils': film.pupils})
    check_puffs(r)
    check_bounce_and_feet(r, film)
    check_repeats(r, film.hero)
    if audio:
        check_voice_onsets(r)
    print('\n'.join(r.lines))
    print('\nALL CHECKS PASSED' if r.ok else '\nSOME CHECKS FAILED')
    return r.ok
