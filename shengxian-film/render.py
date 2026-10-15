"""Render the film.

  python3 render.py stills 16.2 32.5 ...          -> out/stills/*.png
  python3 render.py sheet 0 254 48                -> out/sheet.png (contact sheet)
  python3 render.py video --fps 30 --workers 4    -> out/shengxian.mp4 (with audio)
      [--start S --end E]  render a time range only (for review)
"""
import argparse
import math
import os
import subprocess
import sys
import time
from multiprocessing import Pool

import numpy as np
import cv2
import skia

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from film.core import W, H, DURATION, Audio, bloom, finish, smooth, lin, bar, clamp  # noqa: E402
from film import scenes as S  # noqa: E402
from film.text import draw_cues  # noqa: E402

OUT = os.path.join(HERE, 'out')
AUDIO_SRC = os.environ.get('SX_AUDIO', os.path.join(HERE, 'data', 'song.m4a'))

_state = {}


def _init():
    if 'A' not in _state:
        _state['A'] = Audio()
        _state['arr'] = np.zeros((H, W, 4), np.float32)
        _state['txt'] = np.zeros((H, W, 4), np.float32)
        _state['surf'] = skia.Surface(_state['arr'], colorType=skia.kRGBA_F32_ColorType, alphaType=skia.kPremul_AlphaType)
        _state['tsurf'] = skia.Surface(_state['txt'], colorType=skia.kRGBA_F32_ColorType, alphaType=skia.kPremul_AlphaType)
    return _state


ACTS = [S.act_stone, S.act_cosmos, S.act_bone, S.act_altar, S.act_ancestors,
        S.act_presence, S.act_city, S.act_convergence, S.act_return]


def fog_amount(t):
    return 1.0


def render_frame(t, idx=0):
    st = _init()
    A = st['A']
    arr = st['arr']
    c = st['surf'].getCanvas()
    S.paint_background(arr, t, fog_amt=fog_amount(t))
    # gentle camera breathing + a small bump on every kick
    cs = (1.02 + 0.015 * math.sin(2 * math.pi * t / 40.0)) * (1 + 0.007 * A.kick(t, 0.15))
    dx = 10 * math.sin(2 * math.pi * t / 53.0)
    dy = 7 * math.sin(2 * math.pi * t / 47.0 + 1.0)
    c.save()
    c.translate(W / 2 + dx, H / 2 + dy)
    c.scale(cs, cs)
    c.translate(-W / 2, -H / 2)
    for act in ACTS:
        act(c, arr, t, A)
    c.restore()
    img = arr[..., :3]
    # global exposure: gentle lift on kicks during drops
    img = bloom(img, thresh=0.55, strength=1.0)
    # text layer
    txt = st['txt']
    txt[...] = 0
    tc = st['tsurf'].getCanvas()
    draw_cues(tc, t)
    a = txt[..., 3:4]
    if a.max() > 0:
        tb = bloom(txt[..., :3], thresh=0.75, strength=0.35)
        img = img * (1 - a) + tb
    # fade in / out
    fade = smooth(lin(t, 0.0, 1.2)) * (1 - smooth(lin(t, DURATION - 2.4, DURATION - 0.15)))
    img = img * fade
    return finish(img, idx)


def write_png(path, rgb):
    cv2.imwrite(path, cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))


def cmd_stills(times):
    os.makedirs(os.path.join(OUT, 'stills'), exist_ok=True)
    for t in times:
        t0 = time.time()
        rgb = render_frame(t, int(t * 30))
        p = os.path.join(OUT, 'stills', f'{t:07.2f}.png')
        write_png(p, rgb)
        print(p, f'{time.time() - t0:.2f}s', flush=True)


def _sheet_job(t):
    rgb = render_frame(t, int(t * 30))
    return t, cv2.resize(rgb, (W // 4, H // 4), interpolation=cv2.INTER_AREA)


def cmd_sheet(t0, t1, n, cols=6, name='sheet.png', workers=4):
    ts = list(np.linspace(t0, t1, n))
    with Pool(workers) as p:
        res = p.map(_sheet_job, ts)
    res.sort(key=lambda r: r[0])
    rows = math.ceil(len(res) / cols)
    sheet = np.zeros((rows * (H // 4 + 22), cols * (W // 4), 3), np.uint8)
    for i, (t, im) in enumerate(res):
        r, cc = divmod(i, cols)
        y = r * (H // 4 + 22)
        sheet[y:y + H // 4, cc * (W // 4):(cc + 1) * (W // 4)] = im
        cv2.putText(sheet, f'{t:6.2f}', (cc * (W // 4) + 6, y + H // 4 + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
    os.makedirs(OUT, exist_ok=True)
    write_png(os.path.join(OUT, name), sheet)
    print(os.path.join(OUT, name))


def _segment_job(args):
    seg_id, f0, f1, fps, path, crf = args
    if os.path.exists(path + '.done'):        # resumable: finished segments are kept
        return path
    cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-pix_fmt', 'yuv420p',
           '-profile:v', 'high', '-x264-params', f'keyint={2 * fps}:min-keyint={fps}', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t_start = time.time()
    for f in range(f0, f1):
        t = f / fps
        rgb = render_frame(t, f)
        p.stdin.write(rgb.tobytes())
        if (f - f0) % 60 == 0:
            el = time.time() - t_start
            print(f'[seg {seg_id}] {f - f0}/{f1 - f0} frames, {el:.0f}s', flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f'ffmpeg failed on segment {seg_id}')
    open(path + '.done', 'w').close()
    return path


def cmd_video(fps, workers, start, end, crf, name):
    os.makedirs(os.path.join(OUT, 'seg'), exist_ok=True)
    f_start = int(round(start * fps))
    f_end = int(round(min(end, DURATION) * fps))
    nseg = max(workers * 12, 1)
    bounds = np.linspace(f_start, f_end, nseg + 1).astype(int)
    jobs = []
    for i in range(nseg):
        path = os.path.join(OUT, 'seg', f'{name}_{i:03d}.mp4')
        jobs.append((i, int(bounds[i]), int(bounds[i + 1]), fps, path, crf))
    t0 = time.time()
    with Pool(workers) as p:
        paths = p.map(_segment_job, jobs, chunksize=1)
    print(f'rendered in {time.time() - t0:.0f}s')
    lst = os.path.join(OUT, 'seg', f'{name}_list.txt')
    with open(lst, 'w') as f:
        for pth in paths:
            f.write(f"file '{pth}'\n")
    silent = os.path.join(OUT, f'{name}_silent.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', silent], check=True)
    final = os.path.join(OUT, f'{name}.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-ss', f'{start:.4f}', '-t', f'{(f_end - f_start) / fps:.4f}',
                    '-i', AUDIO_SRC, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
                    '-ar', '48000', '-movflags', '+faststart', '-shortest', final], check=True)
    print(final)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode')
    ap.add_argument('args', nargs='*', type=float)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--start', type=float, default=0.0)
    ap.add_argument('--end', type=float, default=DURATION)
    ap.add_argument('--crf', type=int, default=17)
    ap.add_argument('--name', default='shengxian')
    ap.add_argument('--cols', type=int, default=6)
    a = ap.parse_args()
    if a.mode == 'stills':
        cmd_stills(a.args)
    elif a.mode == 'sheet':
        t0, t1, n = a.args
        cmd_sheet(t0, t1, int(n), cols=a.cols, name=a.name + '_sheet.png', workers=a.workers)
    elif a.mode == 'video':
        cmd_video(a.fps, a.workers, a.start, a.end, a.crf, a.name)
