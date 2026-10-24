"""人生不过几个八拍 — render driver.

  python render.py check                 timeline / key / count alignment checks
  python render.py audio                 build out/audio.wav (+ stems)
  python render.py still 12.3 40 ...     single frames -> out/stills/
  python render.py sheet                 transition key-frame overview -> out/keyframes.png
  python render.py preview               480p preview with sound -> out/preview_480p.mp4
  python render.py final                 1080p H.264 CRF 18 + AAC -> out/life_in_eight_beats_1080p.mp4
      options: --workers N  --start S --end E  --crf N  --scale F

Works on Linux / macOS / Windows (needs ffmpeg on PATH, pycairo, numpy).
"""
import argparse
import math
import os
import shutil
import subprocess
import sys
import time
from multiprocessing import Pool, cpu_count

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(HERE, 'out')

_film = {}


def film():
    if 'f' not in _film:
        from lieb.frame import Film
        _film['f'] = Film()
    return _film['f']


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if not exe:
        sys.exit('ffmpeg not found on PATH (macOS: brew install ffmpeg; Windows: winget install ffmpeg)')
    return exe


# ---------------------------------------------------------------- stills / sheet
def cmd_still(times, scale):
    os.makedirs(os.path.join(OUT, 'stills'), exist_ok=True)
    f = film()
    for t in times:
        t0 = time.time()
        surf = f.render(t, scale)
        p = os.path.join(OUT, 'stills', f'{t:07.3f}.png')
        surf.write_to_png(p)
        print(p, f'{time.time() - t0:.2f}s', flush=True)


def transition_times():
    """Two frames per transition: just before and just after the change."""
    from lieb.timeline import TL
    rows = []
    segs = TL.segs
    rows.append(('S1 开场', TL.S['S1'].t(1)))
    for a, b in zip(segs, segs[1:]):
        if b.key == 'S10':
            tb = TL.t_stop
            rows.append((f'{a.key}→{b.key} 前', tb - 0.5 * a.spb))
            rows.append((f'{a.key}→{b.key} 后', b.t(0.6)))
            continue
        rows.append((f'{a.key}→{b.key} 前', b.t0 - 0.5 * a.spb))
        rows.append((f'{a.key}→{b.key} 后', b.t0 + 0.5 * b.spb))
    S8 = TL.S['S8']
    rows.append(('S8 快放', S8.t(9.2)))
    rows.append(('S8 咳嗽', TL.t_cough + 0.12))
    rows.append(('S8 白鹤亮翅', S8.t(14.5)))
    rows.append(('S10 躺下', TL.S['S10'].t(6.2)))
    rows.append(('S10 八！', TL.t_eight + 0.15))
    rows.append(('片名', TL.t_black + 2.0))
    return rows


def _sheet_job(args):
    label, t, scale = args
    surf = film().render(t, scale)
    import numpy as np
    buf = surf.get_data()
    w, h = surf.get_width(), surf.get_height()
    arr = np.ndarray((h, surf.get_stride() // 4, 4), np.uint8, buf)[:, :w, :3][:, :, ::-1].copy()
    return label, t, arr


def cmd_sheet(workers, name='keyframes.png', rows=None, cols=4, scale=0.25):
    import cairo
    import numpy as np
    rows = rows or transition_times()
    jobs = [(lab, t, scale) for lab, t in rows]
    with Pool(workers) as p:
        res = p.map(_sheet_job, jobs)
    w, h = res[0][2].shape[1], res[0][2].shape[0]
    pad = 30
    nr = math.ceil(len(res) / cols)
    sheet = cairo.ImageSurface(cairo.FORMAT_RGB24, cols * (w + 8) + 8, nr * (h + pad + 8) + 8)
    ctx = cairo.Context(sheet)
    ctx.set_source_rgb(0.12, 0.12, 0.14)
    ctx.paint()
    from lieb.fonts import cjk_font
    for i, (lab, t, arr) in enumerate(res):
        r, c = divmod(i, cols)
        x, y = 8 + c * (w + 8), 8 + r * (h + pad + 8)
        rgba = np.zeros((h, w, 4), np.uint8)
        rgba[:, :, :3] = arr[:, :, ::-1]
        rgba[:, :, 3] = 255
        img = cairo.ImageSurface.create_for_data(memoryview(rgba), cairo.FORMAT_RGB24, w, h)
        ctx.set_source_surface(img, x, y)
        ctx.paint()
        ctx.select_font_face(cjk_font())
        ctx.set_font_size(17)
        ctx.set_source_rgb(0.92, 0.92, 0.92)
        ctx.move_to(x + 4, y + h + 21)
        ctx.show_text(f'{lab}   t={t:6.2f}s')
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    sheet.write_to_png(path)
    print(path)


# ---------------------------------------------------------------- video
def _segment_job(args):
    seg_id, f0, f1, fps, scale, path, crf, preset = args
    if os.path.exists(path + '.done'):
        return path
    f = film()
    import cairo
    w, h = int(round(1920 * scale)), int(round(1080 * scale))
    w -= w % 2
    h -= h % 2
    cmd = [ffmpeg(), '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra', '-s', f'{w}x{h}', '-r', str(fps),
           '-i', '-', '-c:v', 'libx264', '-preset', preset, '-crf', str(crf), '-pix_fmt', 'yuv420p',
           '-profile:v', 'high', '-x264-params', f'keyint={2 * fps}:min-keyint={fps}', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    surf = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
    t_start = time.time()
    for fi in range(f0, f1):
        t = fi / fps
        f.render(t, w / 1920.0, surface=surf)
        surf.flush()
        data = bytes(surf.get_data())
        stride = surf.get_stride()
        if stride != w * 4:
            rows = [data[i * stride:i * stride + w * 4] for i in range(h)]
            data = b''.join(rows)
        p.stdin.write(data)
        if (fi - f0) % 90 == 0:
            print(f'[seg {seg_id}] {fi - f0}/{f1 - f0} frames, {time.time() - t_start:.0f}s', flush=True)
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f'ffmpeg failed on segment {seg_id}')
    open(path + '.done', 'w').close()
    return path


def cmd_video(name, scale, crf, workers, start, end, preset, keep_audio=True):
    from lieb.timeline import TL, FPS
    film()           # builds / caches the spring simulation once before forking
    audio = os.path.join(OUT, 'audio.wav')
    if keep_audio and not os.path.exists(audio):
        cmd_audio()
    end = TL.duration if end is None else min(end, TL.duration)
    f_start, f_end = int(round(start * FPS)), int(round(end * FPS))
    tag = f'{name}_{int(scale * 1080)}p'
    segdir = os.path.join(OUT, 'seg', tag)
    os.makedirs(segdir, exist_ok=True)
    nseg = max(workers * 4, 1)
    bounds = [f_start + (f_end - f_start) * i // nseg for i in range(nseg + 1)]
    jobs = []
    for i in range(nseg):
        if bounds[i + 1] > bounds[i]:
            jobs.append((i, bounds[i], bounds[i + 1], FPS, scale,
                         os.path.join(segdir, f'{i:03d}_{bounds[i]}_{bounds[i + 1]}.mp4'), crf, preset))
    t0 = time.time()
    with Pool(workers) as p:
        paths = p.map(_segment_job, jobs)
    lst = os.path.join(segdir, 'list.txt')
    with open(lst, 'w') as fh:
        for pth in paths:
            fh.write(f"file '{os.path.abspath(pth)}'\n")
    out = os.path.join(OUT, name)
    cmd = [ffmpeg(), '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst]
    if keep_audio and os.path.exists(audio):
        cmd += ['-ss', f'{start:.4f}', '-t', f'{end - start:.4f}', '-i', audio, '-map', '0:v', '-map', '1:a',
                '-c:a', 'aac', '-b:a', '192k']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', '-shortest', out]
    subprocess.run(cmd, check=True)
    print(out, f'{time.time() - t0:.0f}s')


def cmd_audio():
    from lieb.audio.mix import build_audio
    build_audio(os.path.join(OUT, 'audio.wav'))


def cmd_check():
    from lieb.check import run_checks
    ok = run_checks()
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('args', nargs='*')
    ap.add_argument('--workers', type=int, default=max(1, cpu_count()))
    ap.add_argument('--start', type=float, default=0.0)
    ap.add_argument('--end', type=float, default=None)
    ap.add_argument('--crf', type=int, default=None)
    ap.add_argument('--scale', type=float, default=None)
    ap.add_argument('--preset', default=None)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    if a.cmd == 'still':
        cmd_still([float(x) for x in a.args], a.scale or 1.0)
    elif a.cmd == 'sheet':
        cmd_sheet(a.workers)
    elif a.cmd == 'grid':           # python render.py grid t0 t1 n  -> out/grid.png
        t0, t1, n = float(a.args[0]), float(a.args[1]), int(a.args[2])
        rows = [(f'{t0 + (t1 - t0) * i / max(n - 1, 1):.2f}', t0 + (t1 - t0) * i / max(n - 1, 1)) for i in range(n)]
        cmd_sheet(a.workers, name=a.args[3] if len(a.args) > 3 else 'grid.png', rows=rows, cols=6, scale=a.scale or 0.2)
    elif a.cmd == 'preview':
        cmd_video('preview_480p.mp4', a.scale or 480 / 1080, a.crf or 23, a.workers, a.start, a.end, a.preset or 'veryfast')
    elif a.cmd == 'final':
        cmd_video('life_in_eight_beats_1080p.mp4', a.scale or 1.0, a.crf or 18, a.workers, a.start, a.end, a.preset or 'slow')
    elif a.cmd == 'audio':
        cmd_audio()
    elif a.cmd == 'check':
        cmd_check()
    else:
        ap.error('unknown command ' + a.cmd)


if __name__ == '__main__':
    main()
