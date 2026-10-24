"""Mix: counts (per-voice stems with their effect chains) + sound effects + music.
Every placement time comes from TL.cues / TL.segs."""
import json
import os
import wave

import numpy as np

from . import synth as sy
from . import sfx as SFX
from . import music
from .synth import SR
from .voice import syllable, onset, STEM_OF, tts_available
from ..timeline import TL


def place(buf, x, t, align_onset=True, gain=1.0, max_len=None):
    """Put x into buf so that its onset lands exactly on t; returns the sample index of the onset."""
    if max_len is not None and len(x) > max_len:
        x = sy.fade(x[:max_len], 0.0, 0.04)
    o = onset(x) if align_onset else 0
    s = int(round(t * SR)) - o
    a, b = max(0, s), min(len(buf), s + len(x))
    if b > a:
        if buf.ndim == 2:
            buf[a:b] += (x[a - s:b - s] * gain)[:, None]
        else:
            buf[a:b] += x[a - s:b - s] * gain
    return s + o


def _stem_fx(name, y):
    """Effect chain per voice character (applied to the whole stem, onsets stay put)."""
    if name == 'baby':
        y = sy.lowpass(y, 7500)
        return sy.reverb(y, 0.18, 0.8, 5000)
    if name == 'kid':
        return sy.reverb(y, 0.2, 0.7, 5000)
    if name == 'broadcast':        # horn loudspeaker over a stadium
        y = sy.bandpass(y, 380, 3600, 2)
        y = sy.softclip(y * 1.6, 2.5) * 0.7
        y = sy.delay(y, 0.11, 0.35, 0.35, 3, pingpong=False)
        return sy.reverb(y, 0.45, 2.6, 3500, predelay=0.03)
    if name == 'instructor':
        y = sy.highpass(y, 180)
        y = sy.softclip(y * 2.2, 2.0) * 0.75
        return sy.reverb(y, 0.25, 1.4, 4000)
    if name == 'dj':               # echo on the 3/16 grid of 128 BPM
        y = sy.highpass(y, 140)
        y = sy.delay(y, TL.S['S5'].spb * 0.75, 0.45, 0.45, 4)
        return sy.reverb(y, 0.3, 1.6, 5000)
    if name == 'office':
        y = sy.lowpass(y, 3200)
        return sy.reverb(y, 0.12, 0.5, 3000)
    if name == 'auntie':           # a cheap, overdriven plaza speaker
        y = sy.bandpass(y, 300, 4200, 2)
        y = sy.hardclip(y, 2.8, 0.55) * 0.55
        return sy.reverb(y, 0.25, 1.2, 4000)
    if name in ('oldman', 'oldman_slow'):
        y = sy.lowpass(y, 5000)
        return sy.reverb(y, 0.22 if name == 'oldman' else 0.38, 1.4 if name == 'oldman' else 2.4, 3500)
    if name == 'kungfu':
        y = sy.softclip(y * 1.5, 1.5) * 0.8
        return sy.reverb(y, 0.2, 1.0, 5000)
    return sy.reverb(y, 0.15, 0.8)


STEM_GAIN = {'baby': 1.0, 'kid': 0.95, 'broadcast': 1.12, 'instructor': 1.05, 'dj': 1.15, 'office': 0.9,
             'auntie': 0.9, 'oldman': 1.0, 'oldman_slow': 0.95, 'kungfu': 1.0}


def build_counts(n):
    stems = {}
    log = []
    count_times = sorted(q.t for q in TL.cues if q.kind == 'count')
    for q in TL.cues:
        if q.kind not in ('count', 'voice'):
            continue
        v = q.data.get('voice')
        stem = STEM_OF[v]
        if stem not in stems:
            stems[stem] = np.zeros(n)
        x = syllable(v, q.name)
        seg = TL.seg_at(q.t)
        bl = seg.beat_len(seg.beat_at(q.t)) if q.seg else 1.0
        max_len = int(0.9 * bl * SR) if q.kind == 'count' else None
        if q.data.get('cut'):
            max_len = int(q.data['cut'] * SR)
        if q.kind == 'voice' and v != 'kungfu':
            nxt = [c for c in count_times if c > q.t + 1e-6]
            if nxt:
                max_len = int((nxt[0] - q.t - 0.04) * SR)
        g = 1.0 if q.kind == 'count' else 0.9
        idx = place(stems[stem], x, q.t, gain=g, max_len=max_len)
        log.append(dict(t=q.t, text=q.name, voice=v, stem=stem, onset=idx / SR, kind=q.kind))
    return stems, log


def build_sfx(n):
    y = np.zeros((n, 2))
    counters = {}
    for q in TL.cues:
        if q.kind == 'puff':
            x = SFX.puff(q.data.get('small', False), q.data.get('quiet', False))
            place(y, x, q.t - 0.02, align_onset=False, gain=0.8)
            continue
        if q.kind != 'sfx':
            continue
        i = counters.get(q.name, 0)
        counters[q.name] = i + 1
        d = dict(q.data, i=i)
        x = SFX.SFX[q.name](d)
        pre = 0.5 * len(x) / SR if q.name == 'whoosh' else SFX.PRE.get(q.name, 0.0)
        gain = {'whistle': 0.9, 'stomp': 0.9, 'crack': 1.0, 'servo': 0.8, 'cough': 1.1, 'wind': 0.9,
                'snore': 0.9, 'clap': 0.8}.get(q.name, 0.8)
        if q.name in ('whistle', 'crack', 'servo', 'stomp', 'clap', 'pa', 'plop'):
            place(y, x, q.t, align_onset=True, gain=gain)
        else:
            place(y, x, q.t - pre, align_onset=False, gain=gain)
    return y


def to_stereo(x):
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def build_audio(path, stems_dir=None):
    dur = TL.duration
    n = int(dur * SR) + SR
    print('counts...', 'TTS' if tts_available() else 'fallback blips')
    stems, log = build_counts(n)
    voice = np.zeros((n, 2))
    for name, s in stems.items():
        wet = _stem_fx(name, s)
        voice += to_stereo(wet)[:n] * STEM_GAIN.get(name, 1.0)
    print('sfx...')
    fx = build_sfx(n)
    print('music...')
    mus = music.build(dur)[:n]
    mus = np.pad(mus, ((0, max(0, n - len(mus))), (0, 0)))
    # silence is part of the score: hard gates where the brief wants dead air
    def gate(buf, t0, t1, ramp=0.006):
        a, b = int(t0 * SR), int(t1 * SR)
        r = int(ramp * SR)
        buf[a:b] = 0
        buf[a - r:a] *= np.linspace(1, 0, r)[:, None] ** 2
        buf[b:b + r] *= np.linspace(0, 1, r)[:, None]
    S8 = TL.S['S8']
    t_rest0 = S8.t(11) + S8.beat_len(11)
    # tape stopped: dead air, then only the cough
    gate(mus, t_rest0, S8.t(12) - 0.01)
    gate(voice, t_rest0, S8.t(12) - 0.06)
    gate(fx, t_rest0, TL.t_cough - 0.005)
    # 骤停: everything, instantly
    for buf in (mus, fx, voice):
        gate(buf, TL.t_stop, TL.S['S10'].t(0) - 0.05)
    # the long silence before 八: the drawn-out 七 dies, then nothing at all
    for buf in (mus, fx, voice):
        gate(buf, TL.t_seven_end + 0.3, TL.t_morph - 0.01, ramp=0.25)
    # duck the music under the counts a little
    env = np.abs(voice).max(axis=1)
    w = int(0.05 * SR)
    env = np.convolve(env, np.ones(w) / w, mode='same')
    duck = 1 - 0.35 * np.clip(env / 0.3, 0, 1)
    mix = mus * 0.62 * duck[:, None] + fx * 0.85 + voice * 1.0
    # gentle master: soft clip + normalise to -1 dBFS
    mix = sy.softclip(mix * 1.1, 1.3)
    peak = np.abs(mix).max()
    mix = mix / peak * 10 ** (-1 / 20)
    mix = mix[: int(dur * SR)]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    _write_wav(path, mix)
    with open(os.path.join(os.path.dirname(path), 'count_log.json'), 'w', encoding='utf-8') as f:
        json.dump(log, f, ensure_ascii=False, indent=0)
    if stems_dir:
        os.makedirs(stems_dir, exist_ok=True)
        _write_wav(os.path.join(stems_dir, 'music.wav'), mus * 0.62)
        _write_wav(os.path.join(stems_dir, 'sfx.wav'), fx * 0.85)
        _write_wav(os.path.join(stems_dir, 'voice.wav'), voice)
        dry = np.zeros(n)
        for s in stems.values():
            dry += s
        _write_wav(os.path.join(stems_dir, 'voice_dry.wav'), np.stack([dry, dry], 1) * 0.5)
    print(path, f'{len(mix) / SR:.2f}s')
    return mix


def _write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
