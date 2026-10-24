"""The score.  All melodies are original and every note is placed with seg.t(beat), so
the music, the counts and the picture share one grid.

S1 music box · S2 toy piano · S3 march (piano oom-pah + brass) · S4 snare + whistle
S5 electronic · S6 lo-fi · S7 square dance (four-on-the-floor + pentatonic lead)
S8 guzheng-style plucks + pad (pentatonic), with the 2x "fast forward" · S9 collage
S10 almost nothing · title: the music box again
"""
import math
import numpy as np

from . import synth as sy
from .synth import SR, midi_hz
from ..timeline import TL


class Bus:
    def __init__(self, dur):
        self.y = np.zeros((int(dur * SR) + SR, 2))

    def add(self, x, t, gain=1.0, pan=0.0):
        if x.ndim == 1:
            x = sy.pan(x, pan)
        s = int(round(t * SR))
        if s < 0:
            x = x[-s:]
            s = 0
        e = min(len(self.y), s + len(x))
        if e > s:
            self.y[s:e] += x[:e - s] * gain


def notes(bus, seg, seq, inst, gain=1.0, pan=0.0, shift=0.0, **kw):
    """seq: (beat, midi, beats_long[, vel]).  Duration in beats -> seconds on the segment grid."""
    for item in seq:
        b, m, L = item[:3]
        vel = item[3] if len(item) > 3 else 1.0
        t0 = seg.t(b) + shift
        dur = seg.t(b + L) - seg.t(b)
        bus.add(inst(midi_hz(m), dur, vel, **kw) if inst not in (sy.musicbox, sy.toy_piano, sy.pluck, sy.rhodes, sy.piano)
                else inst(midi_hz(m), max(dur, 0.3) * 1.6, vel, **kw), t0, gain, pan)


CHORD = {'C': [60, 64, 67], 'F': [65, 69, 72], 'G': [67, 71, 74], 'Am': [69, 72, 76], 'Dm': [62, 65, 69],
         'G7': [67, 71, 74, 77], 'Em': [64, 67, 71]}
ROOT = {'C': 48, 'F': 41, 'G': 43, 'Am': 45, 'Dm': 38, 'G7': 43, 'Em': 40}


# ================================================================== S1
S1_MEL = [(-0.5, 79, 0.5), (0, 76, 1), (1, 79, 1), (2, 84, 1.5), (3.5, 83, 0.5), (4, 81, 1), (5, 79, 1), (6, 76, 2),
          (8, 77, 1), (9, 81, 1), (10, 86, 1.5), (11.5, 84, 0.5), (12, 83, 1), (13, 79, 1), (14, 84, 2)]


def s1(bus):
    s = TL.S['S1']
    notes(bus, s, S1_MEL, sy.musicbox, 0.9, 0.1)
    prog = ['C', 'C', 'Am', 'G', 'F', 'Dm', 'G', 'C']
    for i, ch in enumerate(prog):
        r = ROOT[ch] + 24
        tri = CHORD[ch]
        for k in range(4):
            b = i * 2 + k * 0.5
            m = [r, tri[1] + 12, tri[2], tri[1] + 12][k]
            bus.add(sy.musicbox(midi_hz(m), 1.0, 0.45), s.t(b), 0.7, -0.2)


# ================================================================== S2
def s2(bus):
    s = TL.S['S2']
    mel = [(0, 77, .5), (.5, 77, .5), (1, 81, .5), (1.5, 84, .5), (2, 81, 1), (3, 77, 1),
           (4, 89, .5), (4.5, 88, .5), (5, 86, .5), (5.5, 84, .5), (6, 82, .5), (6.5, 81, .5), (7, 79, 1)]
    run = [(8 + k * 0.5, m, .5) for k, m in enumerate([72, 74, 76, 77, 79, 81, 82, 84])]
    notes(bus, s, mel + run, sy.toy_piano, 1.0, 0.15)
    # dizzy: detuned, drooping notes
    for k, m in enumerate([84, 82, 81, 79]):
        b = 12 + k * 0.5
        x = sy.toy_piano(midi_hz(m) * (1 - 0.03 * k), 0.6, 0.8)
        x = sy.resample(x, 1 - 0.04 * k)
        bus.add(x, s.t(b), 0.9, 0.0)
    bass = [(b, [53, 48][b % 2], 1, 0.8) for b in range(0, 12)]
    notes(bus, s, bass, sy.toy_piano, 0.8, -0.2)
    for b in range(0, 12):
        bus.add(sy.woodblock(1200 if b % 2 else 900, 0.6), s.t(b + 0.5), 0.5, 0.3)
    # whistle on 14 kills the music; a snare roll says "预备—"
    for k in range(8):
        b = 14.5 + k * 0.25 * 0.5
        bus.add(sy.snare(0.25 + 0.1 * k, 0.12), s.t(b), 0.55)


# ================================================================== S3
def s3(bus):
    s = TL.S['S3']
    mel = [(0, 67, 1), (1, 72, 1), (2, 76, 1), (3, 79, 1), (4, 77, .5), (4.5, 76, .5), (5, 74, 1), (6, 67, 2),
           (8, 69, 1), (9, 74, 1), (10, 77, 1), (11, 81, 1), (12, 79, .5), (12.5, 77, .5), (13, 76, 1), (14, 72, 2),
           (16, 76, 1), (17, 76, 1), (18, 74, 1), (19, 72, 1), (20, 74, .5), (20.5, 76, .5), (21, 74, 1), (22, 67, 1),
           (23, 71, 1)]
    notes(bus, s, mel, sy.brass, 0.9, 0.15)
    notes(bus, s, [(b, m - 12, L, 0.6) for b, m, L in mel], sy.brass, 0.45, -0.15, bright=0.55)
    prog = ['C', 'C', 'F', 'G', 'Dm', 'G', 'C', 'C', 'C', 'G', 'C', 'G7']
    for i, ch in enumerate(prog):
        for k in range(2):
            b = i * 2 + k
            if k == 0:
                bus.add(sy.piano(midi_hz(ROOT[ch]), 0.6, 0.9), s.t(b), 0.8, -0.1)
            else:
                for m in CHORD[ch]:
                    bus.add(sy.piano(midi_hz(m), 0.4, 0.55), s.t(b), 0.6, 0.1)
    for b in range(24):
        bus.add(sy.kick(0.55, 0.3, 0.5), s.t(b), 0.6)
        if b % 2 == 1 and b < 16:
            bus.add(sy.snare(0.6), s.t(b), 0.55)
    for b16 in range(16 * 2, 24 * 2):           # march snare in the last eight, accents on beats
        b = b16 * 0.5
        bus.add(sy.snare(0.75 if b16 % 2 == 0 else 0.4, 0.15), s.t(b), 0.55)


# ================================================================== S4
def cicadas(dur, seed=5):
    t = sy.t_axis(dur)
    buzz = sy.bandpass(sy.noise(len(t), seed), 4000, 7500)
    am = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 42 * t))
    swell = 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t)
    return sy.fade(buzz * am * swell * 0.12, 0.3, 0.05)


def s4(bus):
    s = TL.S['S4']
    # dozing in the heat: drone + cicadas + lazy taps; the whistle wakes the band up
    d = s.t(4) - s.t(0)
    bus.add(cicadas(d), s.t(0), 0.9, 0.3)
    t = sy.t_axis(d)
    drone = (np.sin(2 * np.pi * midi_hz(36) * t) + 0.4 * np.sin(2 * np.pi * midi_hz(43) * t)) * 0.15
    bus.add(sy.fade(drone, 0.2, 0.01), s.t(0), 0.9)
    for b in range(4):
        bus.add(sy.snare(0.2, 0.1), s.t(b), 0.6)
    for b in (4, 5, 6, 7):
        bus.add(sy.kick(0.9, 0.35), s.t(b), 0.9)
        for m in (48, 55, 60, 64):
            bus.add(sy.brass(midi_hz(m), 0.22, 0.9), s.t(b), 0.5)
    for k in range(int((8 - 4.5) * 4)):
        b = 4.5 + k * 0.25
        bus.add(sy.snare(0.5 + 0.03 * k, 0.1), s.t(b), 0.6)


# ================================================================== S5
def s5(bus):
    s = TL.S['S5']
    loc = Bus(s.t1 - s.t0 + 1)
    T = lambda b: s.t(b) - s.t0
    prog = ['Am', 'F', 'C', 'G']
    for b in range(16):
        loc.add(sy.kick(1.0, 0.35), T(b), 0.95)
        loc.add(sy.hat(0.8), T(b + 0.5), 0.6, 0.2)
        if b % 2 == 1:
            loc.add(sy.clap_drum(0.8), T(b), 0.6)
        ch = prog[(b // 4) % 4]
        r = ROOT[ch] if ch != 'Am' else 33
        for k in range(2):
            loc.add(sy.saw_bass(midi_hz(r if k == 0 else r + 12), s.spb * 0.45, 0.8, 900), T(b + k * 0.5), 0.8)
    # robot hits are musical: a chord stab on each servo cue
    for q in TL.find('sfx', 'servo', 'S5'):
        for m in (69, 72, 76):
            x = sy.lead(midi_hz(m), 0.12, 0.9, 0.0)
            loc.add(sy.bitcrush(x, 7, 3), q.t - s.t0, 0.7, 0.1)
    riff = [(6 + k * 0.5, m, 0.45) for k, m in enumerate([69, 72, 76, 81, 79, 76, 72, 74])]
    for b, m, L in riff:
        loc.add(sy.lead(midi_hz(m), s.spb * L, 0.8), T(b), 0.6, -0.1)
    y = loc.y
    # moonwalk: the groove ducks under a low-pass, then the tape stops with the hands
    a, e = int(T(10) * SR), int(T(14) * SR)
    y[a:e] = sy.lowpass(y[a:e], 1800, 2) * 1.2
    y = sy.tape_stop(y, T(14), T(16) - 0.02)
    bus.add(y, s.t0, 1.0)


# ================================================================== S6
def vinyl(dur, seed=3):
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    y = sy.lowpass(rng.standard_normal(n), 2500) * 0.02
    clicks = rng.random(n) < 12 / SR
    y[clicks] += rng.uniform(-0.4, 0.4, clicks.sum())
    return y


def s6(bus):
    s = TL.S['S6']
    loc = Bus(s.t1 - s.t0 + 1)
    T = lambda b: s.t(b) - s.t0
    chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    roots = [41, 40, 38, 36]
    for i in range(4):
        for m in chords[i]:
            loc.add(sy.rhodes(midi_hz(m), s.spb * 4.2, 0.8), T(i * 4) + 0.012 * chords[i].index(m), 0.8)
            loc.add(sy.rhodes(midi_hz(m + 12), s.spb * 1.2, 0.3), T(i * 4 + 2.5), 0.4)
        loc.add(sy.sub(midi_hz(roots[i]), s.spb * 2.5, 0.9), T(i * 4), 0.9)
        loc.add(sy.sub(midi_hz(roots[i]), s.spb * 1.2, 0.7), T(i * 4 + 2.5), 0.8)
    swing = 0.12
    for b in range(16):
        if b % 4 in (0,):
            loc.add(sy.kick(0.7, 0.3, 0.6), T(b), 0.7)
        if b % 4 == 2:
            loc.add(sy.kick(0.5, 0.3, 0.6), T(b + 0.5 + swing), 0.6)
        if b % 2 == 1:
            loc.add(sy.snare(0.45, 0.2), T(b), 0.5)
        loc.add(sy.hat(0.35), T(b + 0.5 + swing), 0.35, 0.2)
    y = sy.lowpass(loc.y, 3800, 2)
    y[:, 0] += vinyl(len(y) / SR, 1)[:len(y)]
    y[:, 1] += vinyl(len(y) / SR, 2)[:len(y)]
    bus.add(y, s.t0, 0.9)


# ================================================================== S7
def s7(bus):
    s = TL.S['S7']
    prog = ['C', 'Am', 'F', 'G']
    for b in range(16):
        bus.add(sy.kick(1.0, 0.3), s.t(b), 0.9)                 # 动
        bus.add(sy.hat(0.9, open_=True), s.t(b + 0.5), 0.45, 0.2)  # 次
        if b % 2 == 1:
            bus.add(sy.snare(0.8, 0.18), s.t(b), 0.55)          # 打
        ch = prog[(b // 4) % 4]
        bus.add(sy.square_bass(midi_hz(ROOT[ch] + 12), s.spb * 0.4, 0.9), s.t(b + 0.5), 0.75)
        for m in CHORD[ch]:
            bus.add(sy.lead(midi_hz(m), s.spb * 0.25, 0.35, 0.0), s.t(b + 0.5), 0.35, -0.2)
    mel = [(0, 81, .5), (.5, 79, .5), (1, 76, 1), (2, 74, .5), (2.5, 76, .5), (3, 79, 1),
           (4, 81, .5), (4.5, 84, .5), (5, 81, .5), (5.5, 79, .5), (6, 76, 2),
           (8, 74, .5), (8.5, 76, .5), (9, 79, 1), (10, 76, .5), (10.5, 74, .5), (11, 72, 1),
           (12, 74, .5), (12.5, 76, .5), (13, 69, .5), (13.5, 72, .5), (14, 74, 2)]
    for b, m, L in mel:
        bus.add(sy.lead(midi_hz(m), s.t(b + L) - s.t(b) - 0.02, 1.0), s.t(b), 0.7, 0.1)


# ================================================================== S8
D_PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81]


def gliss(bus, t, frm, to, step_t=0.035, vel=0.6, gain=0.6):
    i0, i1 = D_PENTA.index(frm), D_PENTA.index(to)
    rng = range(i0, i1 + 1) if i1 >= i0 else range(i0, i1 - 1, -1)
    for k, i in enumerate(rng):
        bus.add(sy.pluck(midi_hz(D_PENTA[i]), 1.2, vel, seed=k), t + k * step_t, gain, 0.1 * (k % 3 - 1))


def s8(bus):
    s = TL.S['S8']
    # first eight (slow)
    gliss(bus, s.t(0) - 0.25, 62, 74)
    mel = [(0, 74, 1.5), (1, 69, .5), (1.5, 71, .5), (2, 74, 1), (3, 76, 1), (4, 78, 1.5), (5.5, 76, .5),
           (6, 74, 1), (7, 71, 1)]
    for b, m, L in mel:
        bend = 1.0 if (b == 4) else 0.0
        bus.add(sy.pluck(midi_hz(m), 2.2, 0.9, bend=bend, seed=int(b * 10)), s.t(b), 0.8, 0.1)
    bus.add(sy.pad([midi_hz(50), midi_hz(57)], s.t(8) - s.t(0) + 0.05, 1.0, 1.0, 0.05), s.t(0), 1.0)
    for b in (0, 4):
        bus.add(sy.pluck(midi_hz(38), 2.5, 0.8), s.t(b), 0.6, -0.2)
    # the 2x fast-forward: a kung-fu riff rendered at the slow tempo, then played twice as fast
    spb = s.spb
    loc = Bus(4 * spb + 1)
    riff = [(0, 69), (0.5, 69), (1, 74), (1.5, 76), (2, 78), (2.5, 76), (3, 74)]
    for b, m in riff:
        loc.add(sy.pluck(midi_hz(m), 0.9, 1.0, bright=0.9), b * spb, 0.9, 0.1)
    for k in range(8):
        loc.add(sy.woodblock(1000 if k % 2 else 760, 0.9), k * 0.5 * spb, 0.6)
    for k in range(4):
        loc.add(sy.tom(110 if k % 2 else 85, 1.0), k * spb, 0.9)
    loc.add(sy.pad([midi_hz(50), midi_hz(57)], 4 * spb, 1.0, 0.05, 0.05), 0, 1.0)
    fastpart = sy.resample(loc.y[:int(4 * spb * SR)], 2.0)
    # the tape is yanked: a tiny stop at the end, then nothing
    fastpart = sy.tape_stop(fastpart, len(fastpart) / SR - 0.07, len(fastpart) / SR)
    bus.add(fastpart, s.t(8), 1.0)
    # second half (slow again, as if nothing happened)
    mel2 = [(12, 71, 1), (13, 69, .5), (13.5, 66, .5)]
    for b, m, L in mel2:
        bus.add(sy.pluck(midi_hz(m), 2.0, 0.85, seed=int(b * 10)), s.t(b), 0.8, 0.1)
    # 白鹤亮翅 hold: a long tremolo note under the wind
    t0 = s.t(14)
    dur = s.t(16) - t0
    for k in range(int(dur / 0.07)):
        bus.add(sy.pluck(midi_hz(74), 0.5, 0.35 + 0.15 * math.sin(k * 0.5), seed=k), t0 + k * 0.07, 0.55, 0.05)
    bus.add(sy.pad([midi_hz(50), midi_hz(57), midi_hz(62)], s.t(16) - s.t(12), 1.0, 0.4, 0.3), s.t(12), 1.0)


# ================================================================== S9
def s9(bus):
    s = TL.S['S9']
    T = s.t
    for b in range(8):
        bus.add(sy.kick(0.9, 0.3), T(b), 0.8)
    bus.add(sy.musicbox(midi_hz(88), 0.6), T(0), 0.8)
    bus.add(sy.musicbox(midi_hz(91), 0.6), T(0.5), 0.8)
    for k, m in enumerate((77, 81, 84)):
        bus.add(sy.toy_piano(midi_hz(m), 0.5), T(1 + k / 3), 0.9)
    bus.add(sy.brass(midi_hz(67), 0.2), T(2), 0.8)
    bus.add(sy.brass(midi_hz(72), 0.2), T(2.5), 0.8)
    for k in range(4):
        bus.add(sy.snare(0.7, 0.1), T(3 + k * 0.25), 0.6)
    bus.add(sy.bitcrush(sy.lead(midi_hz(69), 0.2), 6, 3), T(4), 0.8)
    bus.add(sy.saw_bass(midi_hz(45), 0.2), T(4), 0.7)
    for m in (53, 57, 60, 64):
        bus.add(sy.rhodes(midi_hz(m), 0.5, 0.7), T(5), 0.7)
    bus.add(sy.lead(midi_hz(81), 0.18), T(6), 0.7)
    bus.add(sy.lead(midi_hz(79), 0.18), T(6.5), 0.7)
    gliss(bus, T(7), 62, 81, step_t=0.03, vel=0.7, gain=0.7)
    # a riser over the whole flashback, cut dead at the stop
    d = TL.t_stop - s.t0
    t = sy.t_axis(d)
    nz = sy.noise(len(t), 99)
    riser = np.zeros_like(t)
    nb = 12
    for k in range(nb):
        a, e = k * len(t) // nb, (k + 1) * len(t) // nb
        c = 800 * (8 ** (k / nb))
        riser[a:e] = sy.bandpass(nz, c * 0.7, c * 1.3)[a:e]
    riser *= (t / d) ** 1.5 * 0.5
    riser[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    bus.add(riser, s.t0, 0.8)


# ================================================================== S10 + title
def s10(bus):
    s = TL.S['S10']
    t0 = s.t(0)
    dur = TL.t_seven_end + 0.3 - t0
    bus.add(sy.pad([midi_hz(50), midi_hz(57)], dur, 0.7, 1.2, 1.5), t0, 0.8)
    for b in (0, 2, 4, 6):
        bus.add(sy.pluck(midi_hz(86 if b < 6 else 81), 2.0, 0.35, bright=0.3), s.t(b), 0.45, 0.2)


def title(bus):
    # the opening phrase of S1 again, slower, left hanging on the leading tone
    t0 = TL.t_black + 0.35
    for k, m in enumerate((76, 79, 84, 83)):
        bus.add(sy.musicbox(midi_hz(m), 2.4, 0.55), t0 + k * 0.62, 0.7, 0.1)


def build(dur):
    bus = Bus(dur)
    for f in (s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, title):
        f(bus)
    return bus.y
