"""Procedural instruments and DSP helpers (numpy + scipy).  Everything is synthesised;
no samples, no recordings, no existing melodies."""
import math
import numpy as np
from scipy import signal

SR = 48000


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def env_ad(n, a=0.005, d=0.5, sustain=0.0):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-6), (1 - sustain) * np.exp(-(t - a) / max(d, 1e-6)) + sustain)
    return e


def fade(x, fin=0.003, fout=0.01):
    n = len(x)
    a = min(int(fin * SR), n // 2)
    b = min(int(fout * SR), n // 2)
    y = x.copy()
    if a > 0:
        y[:a] *= np.linspace(0, 1, a)
    if b > 0:
        y[-b:] *= np.linspace(1, 0, b)
    return y


# ------------------------------------------------------------------ filters
def _sos(kind, f, order=2, q=None):
    nyq = SR / 2
    if kind == 'band':
        lo, hi = f
        lo = max(lo, 20.0)
        hi = max(min(hi, nyq * 0.98), lo * 1.05)
        return signal.butter(order, [lo / nyq, hi / nyq], btype='band', output='sos')
    return signal.butter(order, min(f, nyq * 0.98) / nyq, btype=kind, output='sos')


def lowpass(x, f, order=2):
    return signal.sosfilt(_sos('low', f, order), x, axis=0)


def highpass(x, f, order=2):
    return signal.sosfilt(_sos('high', f, order), x, axis=0)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(_sos('band', (lo, hi), order), x, axis=0)


def noise(n, seed=0):
    return np.random.default_rng(seed).standard_normal(n)


# ------------------------------------------------------------------ effects
_IR_CACHE = {}


def reverb_ir(length=1.6, damp=4000, seed=1, predelay=0.0):
    key = (length, damp, seed, predelay)
    if key not in _IR_CACHE:
        n = int(length * SR)
        rng = np.random.default_rng(seed)
        t = np.arange(n) / SR
        decay = np.exp(-6.9 * t / length)
        ir = np.stack([rng.standard_normal(n) * decay, rng.standard_normal(n) * decay], axis=1)
        ir = lowpass(ir, damp, 1)
        ir[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))[:, None]
        if predelay > 0:
            ir = np.concatenate([np.zeros((int(predelay * SR), 2)), ir])
        ir /= np.sqrt(np.sum(ir ** 2) / 2)
        _IR_CACHE[key] = ir
    return _IR_CACHE[key]


def reverb(x, wet=0.25, length=1.6, damp=4000, predelay=0.0, seed=1):
    """x mono or stereo -> stereo with a tail."""
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    ir = reverb_ir(length, damp, seed, predelay)
    tail = len(ir)
    y = np.zeros((len(x) + tail, 2))
    y[:len(x)] += x * (1 - wet * 0.5)
    for c in range(2):
        conv = signal.fftconvolve(x[:, c], ir[:, c])[:len(y)]
        y[:len(conv), c] += wet * 0.35 * conv
    return y


def delay(x, d, fb=0.4, mix=0.4, n=4, pingpong=True):
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    ds = int(d * SR)
    y = np.zeros((len(x) + ds * n, 2))
    y[:len(x)] += x
    for k in range(1, n + 1):
        g = mix * fb ** (k - 1)
        tap = x * g
        if pingpong:
            tap = tap * (np.array([1.0, 0.25]) if k % 2 else np.array([0.25, 1.0]))
        y[k * ds:k * ds + len(x)] += tap
    return y


def softclip(x, drive=2.0):
    return np.tanh(x * drive) / np.tanh(drive)


def hardclip(x, drive=3.0, ceil=0.6):
    return np.clip(x * drive, -ceil, ceil) / ceil


def bitcrush(x, bits=6, hold=4):
    q = 2 ** bits
    y = np.round(x * q) / q
    y = np.repeat(y[::hold], hold)[:len(x)]
    return y


def resample(x, factor):
    """Play x `factor` times faster (pitch up by the same ratio): tape-speed change."""
    n = int(len(x) / factor)
    idx = np.arange(n) * factor
    i0 = np.floor(idx).astype(int)
    fr = idx - i0
    i1 = np.minimum(i0 + 1, len(x) - 1)
    if x.ndim == 1:
        return x[i0] * (1 - fr) + x[i1] * fr
    return x[i0] * (1 - fr)[:, None] + x[i1] * fr[:, None]


def time_stretch(x, ratio, win=0.05):
    """WSOLA-lite overlap-add time stretch (ratio > 1 = longer), pitch preserved."""
    if abs(ratio - 1) < 1e-3:
        return x.copy()
    W = int(win * SR)
    hop_out = W // 4
    hop_in = hop_out / ratio
    n_out = int(len(x) * ratio) + W
    y = np.zeros(n_out)
    wsum = np.zeros(n_out)
    w = np.hanning(W)
    tol = W // 8
    pos_in = 0.0
    out = 0
    prev = None
    while int(pos_in) + W + tol < len(x) and out + W < n_out:
        p = int(pos_in)
        if prev is not None:
            # search the best-matching segment around p for continuity
            target = x[prev + hop_out: prev + hop_out + W] if prev + hop_out + W <= len(x) else None
            best, best_c = p, -1e9
            if target is not None:
                for d in range(-tol, tol + 1, 4):
                    q = p + d
                    if q < 0 or q + W > len(x):
                        continue
                    c = float(np.dot(x[q:q + W:4], target[::4]))
                    if c > best_c:
                        best_c, best = c, q
            p = best
        y[out:out + W] += x[p:p + W] * w
        wsum[out:out + W] += w
        prev = p
        pos_in += hop_in
        out += hop_out
    wsum[wsum < 1e-3] = 1.0
    return (y / wsum)[: int(len(x) * ratio)]


def pitch_shift(x, semis, keep_len=True):
    f = 2 ** (semis / 12.0)
    if keep_len:
        return resample(time_stretch(x, f), f)
    return resample(x, f)


def tape_stop(x, t_start, t_end):
    """Speed ramps from 1 to 0 between t_start and t_end (samples after t_end are silent)."""
    n = len(x)
    s0, s1 = int(t_start * SR), int(t_end * SR)
    out = x.copy()
    if s0 >= n:
        return out
    L = s1 - s0
    k = np.arange(L)
    u = k / L
    speed = (1 - u) ** 1.6
    pos = s0 + np.cumsum(speed)
    pos = np.clip(pos, 0, n - 2)
    i0 = pos.astype(int)
    fr = pos - i0
    seg = x[i0] * (1 - fr)[:, None] + x[i0 + 1] * fr[:, None] if x.ndim == 2 else x[i0] * (1 - fr) + x[i0 + 1] * fr
    g = np.clip((1 - u) * 1.4, 0, 1)
    seg = seg * (g[:, None] if x.ndim == 2 else g)
    out[s0:s1] = seg[: len(out[s0:s1])]
    out[s1:] = 0
    return out


def pan(x, p):
    """mono -> stereo, p in [-1, 1]."""
    a = (p + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)], axis=1)


# ------------------------------------------------------------------ instruments
def musicbox(f, dur=1.6, vel=1.0):
    t = t_axis(dur)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1) +
         0.45 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.5) +
         0.18 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t / 0.25) +
         0.10 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t / 0.08))
    y *= np.minimum(1, t / 0.002)
    return fade(y * vel * 0.5)


def toy_piano(f, dur=0.9, vel=1.0):
    t = t_axis(dur)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.45) +
         0.5 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.18) +
         0.25 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.06) +
         0.15 * np.sin(2 * np.pi * f * 8.9 * t) * np.exp(-t / 0.02))
    y *= np.minimum(1, t / 0.001)
    return fade(y * vel * 0.45)


def piano(f, dur=1.2, vel=1.0, bright=1.0):
    t = t_axis(dur)
    y = np.zeros_like(t)
    for n in range(1, 9):
        fn = f * n * (1 + 0.0004 * n * n)
        if fn > SR / 2.2:
            break
        y += (bright ** (n - 1)) / n ** 1.1 * np.sin(2 * np.pi * fn * t) * np.exp(-t * (1.2 + 0.9 * n) * (f / 400) ** 0.3)
    y *= np.minimum(1, t / 0.003)
    hammer = noise(len(t), int(f)) * np.exp(-t / 0.006) * 0.08
    return fade((y + hammer) * vel * 0.35)


def rhodes(f, dur=2.0, vel=1.0):
    t = t_axis(dur)
    trem = 1 + 0.25 * np.sin(2 * np.pi * 4.5 * t)
    y = (np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3)) * np.exp(-t / 1.4) +
         0.12 * np.sin(2 * np.pi * f * 7.1 * t) * np.exp(-t / 0.05))
    y *= np.minimum(1, t / 0.004) * trem
    return fade(y * vel * 0.3, fout=0.05)


def brass(f, dur=0.5, vel=1.0, bright=0.7):
    t = t_axis(dur + 0.08)
    scoop = 1 - 0.03 * np.exp(-t / 0.03)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.minimum(1, t / 0.25)
    ph = 2 * np.pi * np.cumsum(f * scoop * vib) / SR
    y = np.zeros_like(t)
    for n in range(1, 18):
        if f * n > SR / 2.3:
            break
        y += (bright ** (n - 1)) / n * np.sin(n * ph)
    a = np.minimum(1, t / 0.035)
    r = np.clip((dur - t) / 0.08 + 1, 0, 1)
    y *= a * r * (0.85 + 0.15 * np.exp(-t / 0.1))
    return fade(y * vel * 0.32)


def lead(f, dur=0.4, vel=1.0, vib_depth=0.012):
    """Detuned saw 'electronic keyboard' lead for the square dance."""
    t = t_axis(dur + 0.06)
    vib = 1 + vib_depth * np.sin(2 * np.pi * 6.0 * t) * np.minimum(1, t / 0.15)
    y = np.zeros_like(t)
    for det in (-0.006, 0.0, 0.007):
        ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR
        saw = np.zeros_like(t)
        for n in range(1, 14):
            if f * n > SR / 2.4:
                break
            saw += np.sin(n * ph) / n
        y += saw
    a = np.minimum(1, t / 0.01)
    r = np.clip((dur - t) / 0.05 + 1, 0, 1)
    return fade(lowpass(y * a * r, 5000) * vel * 0.17)


def square_bass(f, dur=0.3, vel=1.0, cutoff=900):
    t = t_axis(dur + 0.02)
    ph = 2 * np.pi * f * t
    y = np.sign(np.sin(ph)) * 0.5 + 0.5 * np.sin(ph)
    y = lowpass(y, cutoff, 2)
    r = np.clip((dur - t) / 0.02 + 1, 0, 1)
    return fade(y * r * np.minimum(1, t / 0.004) * vel * 0.45)


def saw_bass(f, dur=0.3, vel=1.0, cutoff=700):
    t = t_axis(dur + 0.02)
    y = 2 * ((f * t) % 1.0) - 1
    y = lowpass(y, cutoff, 2) + 0.6 * np.sin(2 * np.pi * f * t)
    r = np.clip((dur - t) / 0.02 + 1, 0, 1)
    return fade(y * r * np.minimum(1, t / 0.003) * vel * 0.4)


def sub(f, dur=0.5, vel=1.0):
    t = t_axis(dur)
    return fade(np.sin(2 * np.pi * f * t) * np.exp(-t / (dur * 0.8)) * vel * 0.5, fout=0.03)


def pluck(f, dur=1.8, vel=1.0, bright=0.6, bend=0.0, seed=0):
    """Guzheng-like plucked string (vectorised Karplus-Strong) + optional pitch bend (按音)."""
    n_total = int(dur * SR)
    N = max(2, int(round(SR / f)))
    rng = np.random.default_rng(seed + int(f))
    buf = rng.uniform(-1, 1, N)
    buf = lowpass(buf, 1500 + 6000 * bright, 1)
    out = np.zeros(n_total + N)
    pos = 0
    prev = buf
    decay = 0.996 ** (440.0 / f) ** 0.2
    while pos < n_total:
        out[pos:pos + N] = prev
        nxt = 0.5 * (prev + np.roll(prev, -1)) * decay
        prev = nxt
        pos += N
    y = out[:n_total]
    if bend:
        t = np.arange(n_total) / SR
        ratio = 2 ** (bend * np.clip((t - 0.15) / 0.25, 0, 1) / 12)
        pos_ = np.cumsum(ratio)
        pos_ = np.clip(pos_, 0, n_total - 2)
        i0 = pos_.astype(int)
        y = y[i0]
    t = np.arange(n_total) / SR
    y = y + 0.3 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.6)
    return fade(y * vel * 0.4, fout=0.08)


def pad(freqs, dur=4.0, vel=1.0, attack=0.8, release=1.0):
    t = t_axis(dur)
    y = np.zeros_like(t)
    for f in freqs:
        for det in (-0.003, 0.003):
            y += np.sin(2 * np.pi * f * (1 + det) * t) + 0.25 * np.sin(2 * np.pi * 2 * f * (1 + det) * t)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / release, 0, 1)
    return y * env * vel * 0.08 / max(1, len(freqs))


# ------------------------------------------------------------------ drums
def kick(vel=1.0, dur=0.4, punch=1.0):
    t = t_axis(dur)
    f = 45 + 110 * np.exp(-t / 0.035) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t / 0.22)
    y += 0.3 * noise(len(t), 3) * np.exp(-t / 0.003)
    return fade(y * vel * 0.9, fin=0.0005)


def snare(vel=1.0, dur=0.25, tone=190, snappy=1.0, seed=5):
    t = t_axis(dur)
    nz = bandpass(noise(len(t), seed), 1500, 9000) * np.exp(-t / (0.06 * snappy + 0.02))
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t / 0.04)
    return fade((0.9 * nz + 0.5 * body) * vel * 0.7, fin=0.0005)


def clap_drum(vel=1.0, seed=7):
    t = t_axis(0.3)
    nz = bandpass(noise(len(t), seed), 900, 3500)
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) / 0.007), 0)
    env += 0.6 * np.where(t >= 0.03, np.exp(-(t - 0.03) / 0.08), 0)
    return fade(nz * env * vel * 0.8, fin=0.0005)


def hat(vel=1.0, open_=False, seed=9):
    dur = 0.25 if open_ else 0.06
    t = t_axis(dur)
    y = highpass(noise(len(t), seed), 7000, 2) * np.exp(-t / (0.07 if open_ else 0.015))
    return fade(y * vel * 0.35, fin=0.0003)


def woodblock(f=900, vel=1.0):
    t = t_axis(0.12)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.02) + 0.4 * np.sin(2 * np.pi * f * 2.3 * t) * np.exp(-t / 0.01)
    return fade(y * vel * 0.5, fin=0.0003)


def tom(f=140, vel=1.0):
    t = t_axis(0.4)
    ff = f * (1 + 0.5 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    return fade(np.sin(ph) * np.exp(-t / 0.18) * vel * 0.7, fin=0.0005)


def gong(f=110, dur=3.0, vel=1.0):
    t = t_axis(dur)
    y = np.zeros_like(t)
    for k, (m, a, d) in enumerate(((1, 1, 2.0), (1.52, 0.6, 1.3), (2.31, 0.4, 0.9), (3.1, 0.3, 0.6), (4.7, 0.2, 0.3))):
        y += a * np.sin(2 * np.pi * f * m * t * (1 + 0.002 * np.sin(2 * np.pi * 0.7 * t))) * np.exp(-t / d)
    y += 0.2 * bandpass(noise(len(t), 11), 200, 3000) * np.exp(-t / 0.05)
    return fade(y * vel * 0.3)
