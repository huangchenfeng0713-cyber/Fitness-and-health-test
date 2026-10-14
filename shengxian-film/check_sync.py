"""Measure audio-visual sync of a rendered video.

Decodes the video at low resolution, takes per-frame mean luminance, finds
visual onsets (rises in brightness) and reports their offsets from the
grid-snapped kicks used by the renderer.

  python3 check_sync.py out/v1.mp4
"""
import subprocess
import sys
import os
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from film.core import Audio  # noqa: E402


def luminance(path, w=160, h=90):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    return fr.mean(axis=(1, 2))


def main(path, fps=30.0):
    L = luminance(path)
    t = np.arange(len(L)) / fps
    d = np.diff(L, prepend=L[0])
    A = Audio()
    offs = []
    for k in A.kicks:
        i = int(round(k * fps))
        lo, hi = max(1, i - 4), min(len(d) - 1, i + 5)
        if hi <= lo:
            continue
        j = lo + int(np.argmax(d[lo:hi]))
        if d[j] > 0.15:      # a visible brightening near this kick
            offs.append((j / fps) - k)
    offs = np.array(offs)
    print(f'frames {len(L)}  kicks {len(A.kicks)}  kicks with visible pulse {len(offs)}')
    if len(offs):
        print(f'offset (video - audio) ms: median {np.median(offs) * 1000:.1f}  '
              f'p10 {np.percentile(offs, 10) * 1000:.1f}  p90 {np.percentile(offs, 90) * 1000:.1f}')
    # largest brightness jumps = cuts / flashes
    top = np.argsort(-d)[:15]
    print('largest visual onsets (s):', ', '.join(f'{t[i]:.3f}' for i in sorted(top)))


if __name__ == '__main__':
    main(sys.argv[1])
