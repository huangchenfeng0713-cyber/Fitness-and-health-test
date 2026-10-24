"""Sound effects, all synthesised: whistle, neck crack, costume puff, servo, wind, cough ..."""
import math
import numpy as np

from .synth import (SR, t_axis, noise, lowpass, highpass, bandpass, fade, env_ad, kick, snare, woodblock,
                    clap_drum, toy_piano, midi_hz, pan, resample)


def whistle(dur=0.35, short=True):
    """Pea whistle: ~2.9 kHz tone, strong fast warble from the pea, breathy attack."""
    if not short:
        dur = 0.75
    t = t_axis(dur)
    warble = 1 + 0.06 * np.sin(2 * np.pi * 34 * t) + 0.02 * np.sin(2 * np.pi * 71 * t)
    f = 2850 * warble * (1 + 0.04 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(f) / SR
    am = 0.75 + 0.25 * np.sin(2 * np.pi * 34 * t + 1.0)
    y = np.sin(ph) * am + 0.25 * np.sin(2 * ph) * am
    y += 0.25 * bandpass(noise(len(t), 21), 2000, 6000)
    env = np.minimum(1, t / 0.015) * np.clip((dur - t) / 0.04, 0, 1)
    if not short:      # 哔——！ two-stage blast
        env *= np.where(t < 0.12, 1.0, 0.85 + 0.15 * np.sin(2 * np.pi * 6 * t))
    return fade(y * env * 0.32)


def crack(seed=0):
    """Neck crack: a cluster of sharp bony clicks."""
    n = int(0.12 * SR)
    y = np.zeros(n)
    rng = np.random.default_rng(seed + 30)
    for k in range(rng.integers(3, 6)):
        p = int(rng.uniform(0, 0.05) * SR)
        L = int(0.008 * SR)
        click = bandpass(noise(L, seed * 7 + k), 1800, 7000) * np.exp(-np.arange(L) / (0.0015 * SR))
        y[p:p + L] += click * rng.uniform(0.5, 1.0)
    body = np.sin(2 * np.pi * 420 * np.arange(n) / SR) * np.exp(-np.arange(n) / (0.01 * SR)) * 0.4
    return fade((y + body) * 0.9, fin=0.0002)


def puff(small=False, quiet=False):
    """Costume change '噗': soft low air burst with a pop."""
    dur = 0.32 if small else 0.45
    t = t_axis(dur)
    nz = lowpass(noise(len(t), 41), 900 if not small else 1400, 2)
    env = np.exp(-t / (0.09 if not small else 0.06)) * np.minimum(1, t / 0.006)
    pop_f = 260 * np.exp(-t / 0.05) + 70
    pop = np.sin(2 * np.pi * np.cumsum(pop_f) / SR) * np.exp(-t / 0.04)
    y = nz * env * 1.6 + pop * 0.6
    g = 0.45 if quiet else (0.6 if small else 0.9)
    return fade(y * g)


def servo(seed=0, dur=0.16):
    """Robot joint: short whine glide + clunk."""
    t = t_axis(dur)
    f = 900 + 500 * (t / dur) + 50 * seed
    ph = 2 * np.pi * np.cumsum(f) / SR
    whine = np.sign(np.sin(ph)) * 0.5 + 0.5 * np.sin(2 * ph)
    whine = bandpass(whine, 600, 4000) * np.minimum(1, t / 0.01) * np.clip((dur - t) / 0.02, 0, 1) * 0.35
    clunk = np.zeros_like(t)
    L = int(0.05 * SR)
    clunk[:L] = (np.sin(2 * np.pi * 140 * np.arange(L) / SR) * np.exp(-np.arange(L) / (0.012 * SR)) +
                 0.5 * bandpass(noise(L, 5), 2000, 8000) * np.exp(-np.arange(L) / (0.003 * SR)))
    return fade(whine + clunk * 0.9)


def scratch():
    """Record scratch (forward-back wiggle of a filtered noise+tone)."""
    t = t_axis(0.35)
    speed = np.sin(2 * np.pi * 5.5 * t) * (1 - t / 0.35)
    pos = np.cumsum(np.abs(speed)) / SR
    src = np.sin(2 * np.pi * 300 * pos * 8) + 0.6 * bandpass(noise(len(t), 3), 800, 5000)
    y = src * (np.abs(speed) ** 0.7)
    return fade(y * 0.5)


def whoosh(dur=0.35, lo=300, hi=3000, seed=4, rev=False):
    t = t_axis(dur)
    nz = noise(len(t), seed)
    # sweep a band through the noise in a few blocks
    y = np.zeros_like(t)
    nb = 8
    for k in range(nb):
        a, b = k * len(t) // nb, (k + 1) * len(t) // nb
        u = k / (nb - 1)
        c = lo * (hi / lo) ** (u if not rev else 1 - u)
        y[a:b] = bandpass(nz, c * 0.7, c * 1.4)[a:b]
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return fade(y * env * 0.8)


def wind(dur=2.6):
    t = t_axis(dur)
    nz = noise(len(t), 77)
    y = np.zeros_like(t)
    nb = 26
    for k in range(nb):
        a, b = k * len(t) // nb, (k + 1) * len(t) // nb
        c = 750 + 300 * math.sin(k * 0.9) + 200 * math.sin(k * 0.37)
        y[a:b] = bandpass(nz, c * 0.6, c * 1.6)[a:b]
    gust = 0.6 + 0.4 * np.sin(2 * np.pi * 0.9 * t) * np.sin(2 * np.pi * 0.37 * t + 1)
    env = np.minimum(1, t / 0.4) * np.clip((dur - t) / 0.6, 0, 1)
    howl = 0.15 * np.sin(2 * np.pi * np.cumsum(620 + 80 * np.sin(2 * np.pi * 0.5 * t)) / SR)
    return fade((y * gust + howl * gust) * env * 0.7)


def cough():
    """Old-man cough: two noisy bursts shaped by throat formants plus a voiced grunt."""
    out = np.zeros(int(0.55 * SR))
    for k, (d, a) in enumerate(((0.0, 1.0), (0.2, 0.7))):
        n = int(0.16 * SR)
        t = np.arange(n) / SR
        src = noise(n, 90 + k)
        burst = (bandpass(src, 350, 900) * 1.0 + bandpass(src, 1100, 2200) * 0.6 + bandpass(src, 2500, 3600) * 0.25)
        env = np.minimum(1, t / 0.004) * np.exp(-t / 0.045)
        f0 = 120 - 30 * t / 0.16
        voiced = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR)) * 0.3
        voiced = bandpass(voiced, 250, 1500) * np.exp(-t / 0.05)
        s = int(d * SR)
        out[s:s + n] += (burst * 1.4 + voiced) * env * a
    return fade(out * 0.6)


def snore(dur=0.6):
    t = t_axis(dur)
    f0 = 70 + 15 * np.sin(np.pi * t / dur)
    buzz = np.sign(np.sin(2 * np.pi * np.cumsum(f0) / SR))
    y = bandpass(buzz, 150, 900) * 0.6 + 0.3 * lowpass(noise(len(t), 8), 600)
    env = np.sin(np.pi * t / dur) ** 2
    return fade(y * env * 0.35)


def stomp(soft=False):
    y = kick(vel=0.9 if not soft else 0.45, dur=0.25, punch=0.6)
    n = len(y)
    y = y + 0.4 * bandpass(noise(n, 13), 200, 2000) * np.exp(-np.arange(n) / (0.02 * SR)) * (0.5 if soft else 1)
    return y * (0.6 if soft else 1.0)


def plop():
    t = t_axis(0.25)
    f = 300 * np.exp(-t / 0.04) + 90
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.08)
    return fade(y * 0.6 + 0.2 * lowpass(noise(len(t), 2), 500) * np.exp(-t / 0.03))


def boing():
    t = t_axis(0.5)
    f = 180 + 120 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / 0.25)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.25)
    return fade(y * 0.45)


def twinkle(seed=0):
    out = np.zeros(int(0.5 * SR))
    notes = [88, 91, 95] if seed % 2 == 0 else [91, 95, 98]
    for k, m in enumerate(notes):
        x = toy_piano(midi_hz(m), 0.4, 0.5)
        s = int(k * 0.045 * SR)
        out[s:s + len(x)] += x[:len(out) - s]
    return out


def tweet():
    """Cartoon dizzy birds: fast chirps."""
    out = np.zeros(int(0.9 * SR))
    for k in range(5):
        n = int(0.07 * SR)
        t = np.arange(n) / SR
        f = 3200 + 1400 * np.sin(np.pi * t / 0.07) + 300 * k
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.07)
        s = int(k * 0.15 * SR)
        out[s:s + n] += y * 0.25
    return out


def spin():
    return whoosh(1.6, 400, 2400, seed=12) * 0.7


def keys(dur=1.1, rate=12):
    out = np.zeros(int(dur * SR))
    rng = np.random.default_rng(3)
    t = 0.0
    while t < dur - 0.05:
        n = int(0.02 * SR)
        click = bandpass(noise(n, int(t * 1000)), 2000, 7000) * np.exp(-np.arange(n) / (0.003 * SR))
        s = int(t * SR)
        out[s:s + n] += click * rng.uniform(0.3, 0.6)
        t += rng.uniform(0.6, 1.4) / rate
    return out * 0.7


def chair():
    t = t_axis(0.7)
    y = lowpass(noise(len(t), 33), 400) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t)) * np.exp(-t / 0.35)
    squeak = np.sin(2 * np.pi * np.cumsum(1300 + 200 * np.sin(2 * np.pi * 3 * t)) / SR) * np.exp(-t / 0.1) * 0.15
    return fade(y * 0.6 + squeak)


def pa():
    """Fans snapping open: a sharp paper/bamboo snap."""
    t = t_axis(0.25)
    y = bandpass(noise(len(t), 50), 1200, 9000) * np.exp(-t / 0.012)
    y += 0.5 * bandpass(noise(len(t), 51), 300, 2000) * np.exp(-t / 0.05)
    y += 0.35 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.02)
    return fade(y * 0.9, fin=0.0002)


def tsk():
    t = t_axis(0.12)
    y = highpass(noise(len(t), 61), 3500) * np.exp(-t / 0.03)
    out = np.zeros(int(0.35 * SR))
    out[:len(y)] += y
    out[int(0.17 * SR):int(0.17 * SR) + len(y)] += y * 0.8
    return out * 0.35


def glide():
    t = t_axis(1.6)
    y = bandpass(noise(len(t), 70), 1500, 6000) * (0.3 + 0.2 * np.sin(2 * np.pi * 2.1 * t)) * np.sin(np.pi * t / 1.6)
    return y * 0.25


def slide():
    return whoosh(0.5, 200, 1200, seed=17, rev=True) * 0.8


SFX = {
    'whistle': lambda d: whistle(short=d.get('short', True)),
    'crack': lambda d: crack(d.get('i', 0)),
    'servo': lambda d: servo(d.get('i', 0)),
    'scratch': lambda d: scratch(),
    'whoosh': lambda d: whoosh(0.3 if d.get('fast') else 0.6, seed=d.get('i', 4)),
    'wind': lambda d: wind(),
    'cough': lambda d: cough(),
    'snore': lambda d: snore(),
    'stomp': lambda d: stomp(d.get('soft', False)),
    'plop': lambda d: plop(),
    'boing': lambda d: boing(),
    'clap': lambda d: clap_drum(0.7, seed=d.get('i', 7)),
    'twinkle': lambda d: twinkle(d.get('i', 0)),
    'tweet': lambda d: tweet(),
    'spin': lambda d: spin(),
    'keys': lambda d: keys(),
    'chair': lambda d: chair(),
    'pa': lambda d: pa(),
    'tsk': lambda d: tsk(),
    'glide': lambda d: glide(),
    'slide': lambda d: slide(),
}

# sound that starts before its cue (the cue marks the *peak*)
PRE = {'whoosh': 0.6, 'spin': 0.0, 'slide': 0.25}
