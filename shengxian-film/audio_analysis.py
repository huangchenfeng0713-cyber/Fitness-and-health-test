"""Audio analysis for the film: beat grid + per-frame envelopes.

Usage: python3 audio_analysis.py <song.wav> data/audio_features.npz

The song is a constant 120 BPM; the grid phase (T0) was fitted by maximizing
percussive onset strength over the whole track (see README).
"""
import sys
import json
import numpy as np
import librosa

T0, BEAT = 0.122, 0.5
FPS_ENV = 120  # envelope sample rate (Hz); the renderer interpolates


def band(S, f, lo, hi):
    m = (f >= lo) & (f < hi)
    return S[m].sum(0)


def main(src, dst):
    y, sr = librosa.load(src, sr=44100, mono=True)
    hop = sr // FPS_ENV  # 367 samples
    n_fft = 2048
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop, center=True))
    f = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    t = np.arange(S.shape[1]) * hop / sr

    def onset(x):
        d = np.maximum(0, np.diff(np.log1p(x * 50), prepend=np.log1p(x[0] * 50)))
        return d / (np.percentile(d, 99.5) + 1e-9)

    sub = band(S, f, 30, 110)
    snare = band(S, f, 1500, 5000)
    hat = band(S, f, 7000, 16000)
    full = np.sqrt((S ** 2).sum(0))
    loud = full / np.percentile(full, 99)
    loud_s = np.convolve(loud, np.ones(24) / 24, mode='same')

    feats = dict(
        t=t.astype(np.float32),
        kick_on=onset(sub).astype(np.float32),
        snare_on=onset(snare).astype(np.float32),
        hat_on=onset(hat).astype(np.float32),
        sub=(sub / np.percentile(sub, 99)).astype(np.float32),
        hat=(hat / np.percentile(hat, 99)).astype(np.float32),
        loud=np.clip(loud_s, 0, 1.5).astype(np.float32),
        duration=np.float32(len(y) / sr),
    )
    # strong onset events (peaks) for off-grid accents
    o = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    pk = librosa.util.peak_pick(o, pre_max=6, post_max=6, pre_avg=30, post_avg=30, delta=np.percentile(o, 90) * 0.5, wait=6)
    feats['onsets'] = (pk * hop / sr).astype(np.float32)
    feats['onset_strength'] = (o[pk] / np.percentile(o, 99.5)).astype(np.float32)
    np.savez_compressed(dst, **feats)
    print('duration', feats['duration'], 'frames', len(t), 'onsets', len(pk))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
