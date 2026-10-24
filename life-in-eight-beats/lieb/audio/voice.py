"""Count voices: Microsoft Edge neural TTS (edge-tts), one syllable per file, cached in
assets/tts so rendering never needs the network.  Each life stage gets its own voice
character by pitch/tempo changes, filtering, distortion, delay and reverb.

Alignment: every syllable's onset (first point where its 5 ms envelope reaches 20 % of
its peak) is placed exactly on the count cue's time from the timeline.
If no TTS is available at all, a formant "blip" stands in for each word (README).
"""
import asyncio
import json
import os
import shutil
import subprocess

import numpy as np

from .synth import SR, pitch_shift, time_stretch, resample, lowpass, highpass, bandpass, fade

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CACHE = os.path.join(ROOT, 'assets', 'tts')

DIGITS = '一二三四五六七八'

# voice key: (edge voice, rate, pitch, texts)
VOICES = {
    'baby': ('zh-CN-YunxiaNeural', '-5%', '+30Hz', list(DIGITS) + ['咿', '呀']),
    'baby_final': ('zh-CN-YunxiaNeural', '+0%', '+45Hz', ['八！']),
    'kid': ('zh-CN-YunxiaNeural', '+8%', '+8Hz', list(DIGITS)),
    'broadcast': ('zh-CN-YunyangNeural', '+0%', '+0Hz', list(DIGITS)),
    'instructor': ('zh-CN-YunjianNeural', '+20%', '-4Hz', [d + '！' for d in DIGITS]),
    'dj': ('zh-CN-YunxiNeural', '+0%', '-6Hz', list(DIGITS)),
    'office': ('zh-CN-YunxiNeural', '-25%', '-14Hz', list(DIGITS) + ['唉……']),
    'auntie': ('zh-CN-liaoning-XiaobeiNeural', '+12%', '+0Hz', [d + '！' for d in DIGITS]),
    'oldman': ('zh-CN-YunxiNeural', '-30%', '-22Hz', list(DIGITS)),
    'kungfu': ('zh-CN-YunjianNeural', '+15%', '+0Hz', ['嘿！', '哈！']),
}


def _fname(text):
    return '_'.join('u%04x' % ord(ch) for ch in text) + '.mp3'


def _path(voice, text):
    return os.path.join(CACHE, voice, _fname(text))


def fetch_all(force=False):
    """Download every syllable that is not cached yet (needs network + edge-tts)."""
    try:
        import certifi
        ca = os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE')
        if ca:
            certifi.where = lambda: ca
        import edge_tts
    except ImportError:
        print('edge-tts not installed; using cached / fallback voices')
        return False

    async def one(voice, rate, pitch, text, path):
        c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
        await c.save(path)

    async def run():
        n = 0
        for key, (voice, rate, pitch, texts) in VOICES.items():
            os.makedirs(os.path.join(CACHE, key), exist_ok=True)
            for tx in texts:
                p = _path(key, tx)
                if os.path.exists(p) and not force:
                    continue
                for attempt in range(4):
                    try:
                        await one(voice, rate, pitch, tx, p)
                        n += 1
                        break
                    except Exception as e:      # network hiccup: retry
                        if attempt == 3:
                            print('TTS failed', key, tx, e)
                        await asyncio.sleep(2 ** attempt)
        return n

    n = asyncio.run(run())
    manifest = {k: dict(voice=v[0], rate=v[1], pitch=v[2], texts=v[3]) for k, v in VOICES.items()}
    with open(os.path.join(CACHE, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'fetched {n} syllables')
    return True


def _decode(path):
    exe = shutil.which('ffmpeg')
    out = subprocess.run([exe, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).astype(np.float64)


def _trim(x, thr=0.02):
    a = np.abs(x)
    m = a.max() if len(a) else 0
    if m <= 0:
        return x
    idx = np.where(a > thr * m)[0]
    i0 = max(0, idx[0] - int(0.01 * SR))
    i1 = min(len(x), idx[-1] + int(0.03 * SR))
    return fade(x[i0:i1], 0.002, 0.02)


def onset(x):
    """Sample index of the perceptual attack: 5 ms RMS envelope reaches 20 % of its peak."""
    w = int(0.005 * SR)
    env = np.sqrt(np.convolve(x * x, np.ones(w) / w, mode='same'))
    m = env.max()
    if m <= 0:
        return 0
    return int(np.argmax(env >= 0.2 * m))


def _blip(text, voice):
    """Fallback when no TTS exists: a short vowel-ish formant blip per word."""
    base = {'baby': 420, 'baby_final': 460, 'kid': 330, 'broadcast': 150, 'instructor': 120, 'dj': 130,
            'office': 105, 'auntie': 260, 'oldman': 95, 'kungfu': 140}.get(voice, 200)
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f0 = base * (1 + 0.1 * (DIGITS.find(text[0]) % 4) / 4)
    src = np.sign(np.sin(2 * np.pi * f0 * t)) * 0.5
    y = bandpass(src, 500, 1200) + 0.6 * bandpass(src, 1500, 2600)
    y *= np.minimum(1, t / 0.01) * np.exp(-t / 0.12)
    return y / (np.abs(y).max() + 1e-9) * 0.6


_RAW = {}


def raw(voice, text):
    key = (voice, text)
    if key not in _RAW:
        p = _path(voice, text)
        if os.path.exists(p) and shutil.which('ffmpeg'):
            x = _trim(_decode(p))
        else:
            x = _blip(text, voice)
        x = x / (np.abs(x).max() + 1e-9) * 0.8
        _RAW[key] = x
    return _RAW[key]


def tts_available():
    return os.path.isdir(CACHE) and any(f.endswith('.mp3') for _, _, fs in os.walk(CACHE) for f in fs)


# ------------------------------------------------------------------ per-syllable shaping
def syllable(voice, text):
    """Return the processed dry syllable for a count voice."""
    if voice == 'baby_final':
        text = '八！'
    if voice == 'office' and text == '唉':
        text = '唉……'
    if voice in ('baby', 'baby_final'):
        x = raw(voice, text)
        x = pitch_shift(x, 3.0)
        return x * (1.0 if voice == 'baby' else 1.15)
    if voice == 'kid':
        return pitch_shift(raw('kid', text), 1.0)
    if voice == 'office':
        x = raw('office', text)
        return time_stretch(pitch_shift(x, -1.5), 1.12) * 0.85
    if voice in ('oldman', 'oldman_fast', 'oldman_slow'):
        x = pitch_shift(raw('oldman', text), -2.5)
        x = time_stretch(x, 1.2 if voice != 'oldman_slow' else 1.7)
        t = np.arange(len(x)) / SR
        x = x * (1 - 0.18 * (0.5 + 0.5 * np.sin(2 * np.pi * 5.2 * t)))      # old-man tremolo
        if voice == 'oldman_fast':
            x = resample(x, 2.0)                                            # tape at double speed
        if voice == 'oldman_slow':
            x = x * 0.8
        return x
    if voice == 'broadcast':
        return raw('broadcast', text)
    if voice == 'instructor':
        return raw('instructor', text + '！' if not text.endswith('！') else text)
    if voice == 'dj':
        return raw('dj', text)
    if voice == 'auntie':
        return raw('auntie', text + '！' if not text.endswith('！') else text)
    if voice == 'kungfu':
        return raw('kungfu', text + '！' if not text.endswith('！') else text)
    return raw(voice, text)


# which stem (= effect chain) a voice goes through
STEM_OF = {'baby': 'baby', 'baby_final': 'baby', 'kid': 'kid', 'broadcast': 'broadcast',
           'instructor': 'instructor', 'dj': 'dj', 'office': 'office', 'auntie': 'auntie',
           'oldman': 'oldman', 'oldman_fast': 'oldman', 'oldman_slow': 'oldman_slow', 'kungfu': 'kungfu'}
