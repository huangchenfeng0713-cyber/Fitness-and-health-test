"""Assemble the short film 《零点二秒》 from the timeline below.

Usage: python3 build.py [--preview]   (--preview renders a fast 960x540 version)
"""
import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

import graphics

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
FPS = graphics.FPS
INFO = json.load(open("src/info.json"))
VB = json.load(open("vo/bounds.json"))
LINES = dict(l.rstrip("\n").split("\t") for l in open("vo/lines.tsv", encoding="utf-8"))
PREVIEW = "--preview" in sys.argv

E21, E23 = "src/nasa/earth4k_2021.mp4", "src/nasa/earth4k_2023.mp4"
O1, O2 = "src/nasa/orion_first.mp4", "src/nasa/orion_lookback.mp4"


def mk(i):
    return f"src/mk/{i}.mp4"


def ia(i):
    return f"src/ia/{i}.mp4"


def V(src, t=1.0, w=1.0, tin=None):
    """Video shot. t = in-point (s), w = relative length in its beat, tin = transition into it."""
    return dict(kind="v", src=src, t=t, w=w, tin=tin, archival=src.startswith("src/ia/"))


def G(name, w=1.0, tin=None):
    return dict(kind="g", name=name, w=w, tin=tin)


CUT = ("cut", 0)


def fade(d):
    return ("fade", d)


def black(d):
    return ("fadeblack", d)


# --------------------------------------------------------------------------- timeline
# Beat: vo line (or fixed dur), pad before speech, pad after speech, transition in, shots.
B = []


def beat(vo=None, pre=0.4, post=1.2, dur=None, tin=None, shots=None, tag=None):
    tin = tin or fade(0.8)
    B.append(dict(vo=vo, pre=pre, post=post, dur=dur, tin=tin, shots=shots, tag=tag))


# P0 opening
beat(dur=13.0, tin=("in", 0), shots=[V(mk(4148), 1.0)], tag="open")
# P1 scale
beat("n01", 1.0, 1.4, tin=fade(1.5), shots=[V(E21, 9 * 60 + 5)])
beat("n02", 0.4, 1.2, tin=fade(1.0), shots=[V(E21, 29 * 60 + 45), V(E23, 527, tin=fade(0.8))])
beat("n03", 0.4, 1.6, tin=fade(1.0), shots=[V(O2, 3)])
beat("n04", 0.6, 0.6, tin=fade(1.5), shots=[G("pbd")])
beat("n05", 0.3, 1.8, shots="cont")
beat("n06", 0.6, 1.4, tin=fade(1.2), shots=[G("webb")])
beat("n07", 0.4, 1.8, tin=fade(1.0), shots=[V(mk(34041), 1.5)])
# P2 cosmic calendar
beat("n08", 1.0, 0.9, tin=fade(1.2), shots=[G("cal")], tag="cal")
beat("n09", 0.3, 1.0, shots="cont")
beat("n10", 0.3, 1.0, shots="cont")
beat("n11", 0.3, 1.2, shots="cont")
beat("n12", 0.3, 1.8, shots="cont")
beat("n13", 0.4, 1.4, shots="cont")
beat("n14", 0.3, 1.4, shots="cont")
beat("n15", 0.5, 3.2, shots="cont")
# P3 the forgotten
beat("n16", 0.8, 1.4, tin=fade(1.2), shots=[V(ia("NewOrlea1941"), 24), V(ia("NewOrlea1941"), 88)])
beat("n17", 0.3, 1.4, shots=[V(ia("TexasFar1952"), 1.0), V(ia("supervisors_picnic"), 344),
                             V(ia("Wathenco1944"), 432), V(ia("TexasFar1952"), 96)])
beat("n18", 0.4, 1.8, tin=fade(1.0), shots=[V(mk(4644), 0.2), V(ia("Wathenco1944"), 816, tin=fade(1.0))])
beat("n19", 0.5, 1.0, tin=fade(1.0), shots=[V(mk(4401), 2)])
beat("n20", 0.3, 2.0, shots=[V(mk(28616), 0.5), V(mk(918), 1)])
# P4 the turn
beat("n21", 0.8, 1.6, tin=fade(1.5), shots=[V(mk(17217), 1)], tag="turn")
beat("n22", 0.7, 0.8, tin=black(1.2), shots=[V(mk(31629), 3)], tag="musicB")
beat("n23", 0.3, 1.0, shots="cont")
beat("n24", 0.3, 1.2, tin=fade(1.0), shots=[V(mk(26532), 1), V(mk(4397), 0.5, tin=fade(0.8))])
beat("n25", 0.4, 2.0, tin=fade(0.8), shots=[V(mk(36784), 1), V(mk(33546), 1, tin=fade(0.8))], tag="drop")
# P5 live
beat("n26", 0.6, 2.0, tin=fade(1.0), shots=[G("weeks")])
beat("n27", 0.5, 2.6, tin=fade(1.0), shots=[V(mk(6734), 3), V(mk(20425), 10, tin=fade(0.6))])
beat("n28", 0.4, 1.8, shots=[V(mk(45977), 0.5), V(mk(24240), 3)])
beat("n28b", 0.3, 1.8, shots=[V(mk(48636), 0.5), V(mk(42716), 2)])
beat("n29", 0.4, 1.8, shots=[V(mk(42268), 0.5), V(mk(46525), 2)])
beat("n29b", 0.3, 2.2, shots=[V(mk(6472), 2)])
beat("n30", 0.4, 2.2, shots=[V(mk(41563), 1), V(mk(25375), 5), V(mk(46929), 5)])
beat("n31", 0.4, 1.8, shots=[V(mk(33417), 1), V(mk(41010), 1), V(mk(12987), 1)])
beat("n32", 0.4, 1.6, shots=[V(mk(4702), 2), V(mk(43373), 3)])
beat(dur=None, tin=fade(0.6), tag="montage", shots=[
    V(mk(51295), 2), V(mk(40105), 3), V(mk(4636), 1), V(mk(4064), 3), V(mk(48275), 4), V(mk(46049), 3),
    V(mk(4781), 2), V(mk(4663), 6), V(mk(13240), 8), V(mk(21462), 1), V(mk(45474), 0.5), V(mk(14088), 3),
    V(mk(4053), 10), V(mk(3469), 2), V(mk(4764), 0.5)])
beat("n33", 1.6, 1.2, tin=fade(1.0), shots=[V(mk(47356), 2), V(mk(46101), 0.5, tin=fade(1.0))], tag="dip")
beat("n34", 0.4, 1.4, tin=fade(0.8), shots=[V(mk(49974), 1), V(mk(4738), 0.3, tin=fade(0.6)),
                                             V(mk(46203), 1, tin=fade(0.6))])
beat("n35", 0.4, 2.0, tin=fade(0.8), shots=[V(mk(37008), 2)])
# P6 coda
beat("n36", 1.0, 1.6, tin=fade(1.2), shots=[V(E21, 9 * 60 + 40)])
beat("n37", 0.4, 1.3, tin=fade(0.8), shots=[V(E23, 9)])
beat("n38", 0.6, 3.6, tin=fade(0.8), shots=[V(mk(1086), 1)])
beat(dur=7.0, tin=black(1.5), shots=[G("black")], tag="endtitle")
beat(dur=17.0, shots="cont", tag="credits")

# music cue points (seconds into "We Will Get It")
MB_DROP, MB_DIP = 82.0, 176.0
DROP_AT = 3.3  # seconds after the drop beat's speech start ("是一种自由")


def speech(vo):
    v = VB[vo]
    return v["s"], v["e"]


def drop_time():
    return next(x for x in B if x["tag"] == "drop")["speech"][0] + DROP_AT


def layout():
    t = 0.0
    for b in B:
        if b["vo"]:
            s, e = speech(b["vo"])
            b["dur"] = b["pre"] + (e - s) + b["post"]
            b["vo_at"] = t + b["pre"] - s  # file placement time
            b["speech"] = (t + b["pre"], t + b["pre"] + (e - s))
        b["start"] = t
        if b["dur"] is None:  # montage: fill until the music dip
            b["dur"] = max(16.0, (MB_DIP - MB_DROP) - (t - drop_time()))
        t += b["dur"]
    return t


# --------------------------------------------------------------------------- shots

def build_shots():
    shots = []
    for b in B:
        if b["shots"] == "cont":
            shots[-1]["dur"] += b["dur"]
            continue
        tot = sum(s["w"] for s in b["shots"])
        for j, s in enumerate(b["shots"]):
            s = dict(s)
            s["dur"] = b["dur"] * s["w"] / tot
            s["beat_tag"] = b["tag"]
            s["tin"] = b["tin"] if j == 0 else (s["tin"] or (fade(0.35) if b["tag"] == "montage" else fade(0.6)))
            shots.append(s)
    snap_montage(shots)
    # outgoing tail = next transition duration
    for a, nb in zip(shots, shots[1:]):
        a["tail"] = nb["tin"][1] if nb["tin"][0] not in ("cut", "in") else 0.0
    shots[-1]["tail"] = 0.0
    return shots


def snap_montage(shots):
    """Re-time montage shots so each dissolve is centred on a music beat (every 3rd beat)."""
    import numpy as np
    m = next(b for b in B if b["tag"] == "montage")
    idx = [i for i, s in enumerate(shots) if s.get("beat_tag") == "montage"]
    if not idx:
        return
    beats = np.load("src/music/598_beats.npy") - MB_DROP + drop_time()  # film time
    t0, t1 = m["start"], m["start"] + m["dur"]
    n = len(idx)
    cuts = []
    for k in range(1, n):
        target = t0 + m["dur"] * k / n
        c = beats[np.argmin(np.abs(beats - target))] - 0.175  # dissolve midpoint on the beat
        cuts.append(max(c, cuts[-1] + 1.2 if cuts else t0 + 1.2))
    bounds = [t0] + cuts + [t1]
    for k, i in enumerate(idx):
        shots[i]["dur"] = bounds[k + 1] - bounds[k]


def vf_for(s, w, h):
    if s["archival"]:
        sw = int(w * 0.75) // 2 * 2
        return (f"scale={sw}:{h}:flags=lanczos,eq=saturation=0.92:contrast=1.04,"
                f"noise=alls=5:allf=t,vignette=PI/4.5,pad={w}:{h}:(ow-iw)/2:0:black")
    return f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}"


def render_video(s, path, w, h):
    info = INFO[s["src"]]
    need = s["dur"] + s["tail"]
    t_in = s["t"]
    if t_in + need > info["dur"] - 0.05:
        t_in = max(0.0, info["dur"] - need - 0.05)
    speed = 1.0
    if need > info["dur"] - 0.05:
        speed = (info["dur"] - 0.1) / need  # slow down to fit
        t_in = 0.0
        print(f"  slow {s['src']} x{speed:.2f}", flush=True)
    vf = (f"setpts=(PTS-STARTPTS)/{speed:.4f}," if speed < 1 else "") + vf_for(s, w, h) + f",fps={FPS},format=yuv420p"
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", f"{t_in:.3f}", "-i", s["src"], "-t", f"{need * speed:.3f}",
           "-vf", vf, "-an", "-frames:v", str(int(round(need * FPS))), "-c:v", "libx264",
           "-preset", "veryfast" if PREVIEW else "medium", "-crf", "26" if PREVIEW else "14", path]
    subprocess.run(cmd, check=True)


def render_gen(args):
    name, path, dur, keys = args
    if name == "cal":
        graphics.calendar(path, dur, keys)
    elif name == "weeks":
        graphics.weeks(path, dur, keys["n26"])
    elif name == "pbd":
        graphics.kenburns(path, dur, "src/img/palebluedot_2020.jpg", (2615, 2689, 5000), (3110, 2689, 760),
                          mark=(3110, 2689, keys["n05"] + 1.4, "地球"))
    elif name == "webb":
        graphics.kenburns(path, dur, "src/img/webb_deep.png", (980, 1000, 1960), (1036, 1008, 1350))
    elif name == "black":
        p = graphics.writer(path, int(round(dur * FPS)))
        frame = bytes(graphics.W * graphics.H * 3)
        for _ in range(int(round(dur * FPS))):
            p.stdin.write(frame)
        p.stdin.close()
        p.wait()
    return path


def shot_key(s, extra):
    d = {k: v for k, v in s.items() if k not in ("w",)}
    d.update(extra)
    return hashlib.md5(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()[:12]


def render_all(shots):
    os.makedirs("shots", exist_ok=True)
    w, h = (960, 540) if PREVIEW else (1920, 1080)
    vjobs, gjobs = [], []
    for i, s in enumerate(shots):
        if s["kind"] == "g":
            keys = {b["vo"]: b["speech"][0] - s["start"] for b in B if b.get("vo") and s["start"] <= b["start"] < s["start"] + s["dur"]}
            key = shot_key(s, dict(keys=keys, v=7))
            path = f"shots/g_{s['name']}_{key}.mp4"
            s["path"] = path
            if not os.path.exists(path):
                gjobs.append((s["name"], path, s["dur"] + s["tail"], keys))
        else:
            key = shot_key(s, dict(p=PREVIEW, v=3))
            path = f"shots/v_{i:03d}_{key}.mp4"
            s["path"] = path
            if not os.path.exists(path):
                vjobs.append((s, path))
    print(f"render: {len(vjobs)} video shots, {len(gjobs)} generated", flush=True)
    with ProcessPoolExecutor(3) as gp, ThreadPoolExecutor(3) as vp:
        gf = [gp.submit(render_gen, j) for j in gjobs]
        list(vp.map(lambda j: render_video(j[0], j[1], w, h), vjobs))
        for f in gf:
            f.result()
    if PREVIEW:  # generated shots are full size; scale them on the fly in assembly
        pass


# --------------------------------------------------------------------------- subtitles

def sub_text(s):
    s = s.replace("。", "　").replace("，", "　").replace("：", "").strip("　 ")
    s = s.replace("　——", "——")
    if len(s) > 19:
        mid = len(s) / 2
        cands = [i for i, ch in enumerate(s) if ch == "　" or (ch == "—" and i + 1 < len(s) and s[i + 1] == "—")]
        if cands:
            i = min(cands, key=lambda i: abs(i - mid))
            if s[i] == "—":
                s = s[:i + 2] + r"\N" + s[i + 2:]
            else:
                s = s[:i] + r"\N" + s[i + 1:]
    return s


def ts(t):
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def write_ass(total, path):
    hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Noto Serif SC,50,&H00F4F4F4,&H000000FF,&H64000000,&H8C000000,0,0,0,0,100,100,2,0,1,1.6,1.5,2,120,120,64,1
Style: Title,Noto Serif SC,118,&H00F2F2F2,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,24,0,1,0,0,5,0,0,0,1
Style: Tag,Noto Serif SC,38,&H00C8C8C8,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,8,0,1,0,0,5,0,0,0,1
Style: Cred,Noto Serif SC,32,&H00D0D0D0,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,8,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    vo_beats = [b for b in B if b.get("vo")]
    for i, b in enumerate(vo_beats):
        s0, s1 = b["speech"]
        nxt = vo_beats[i + 1]["speech"][0] if i + 1 < len(vo_beats) else total
        end = min(s1 + 0.45, nxt - 0.08)
        ev.append(f"Dialogue: 0,{ts(s0 - 0.08)},{ts(end)},Sub,,0,0,0,,{{\\fad(120,160)}}{sub_text(LINES[b['vo']])}")
    op = next(b for b in B if b["tag"] == "open")
    ev.append(f"Dialogue: 1,{ts(op['start'] + 2.5)},{ts(op['start'] + op['dur'] - 0.6)},Title,,0,0,0,,"
              f"{{\\fad(1600,1400)\\pos(960,500)}}零点二秒")
    ev.append(f"Dialogue: 1,{ts(op['start'] + 4.0)},{ts(op['start'] + op['dur'] - 0.6)},Tag,,0,0,0,,"
              f"{{\\fad(1400,1400)\\pos(960,620)}}关于渺小，和尽情地活")
    et = next(b for b in B if b["tag"] == "endtitle")
    ev.append(f"Dialogue: 1,{ts(et['start'] + 1.4)},{ts(et['start'] + et['dur'] - 0.3)},Title,,0,0,0,,"
              f"{{\\fad(1400,1200)\\pos(960,520)}}零点二秒")
    cr = next(b for b in B if b["tag"] == "credits")
    credits = [
        "{\\fs40}零点二秒", "",
        "旁白　AI 合成语音（Microsoft Edge 神经语音 · 云希）", "",
        "{\\fs36}影像", "国际空间站 4K 地球影像　NASA / JSC",
        "Artemis I 猎户座飞船回望地球　NASA", "暗淡蓝点（2020 重制）　NASA / JPL-Caltech",
        "韦布第一深场　NASA, ESA, CSA, STScI", "1939–1952 年业余影片　Prelinger Archives（公有领域）",
        "实景素材　Mixkit 免费素材库", "",
        "{\\fs36}音乐", "Echoes　Andrew Ev", "We Will Get It　Eugenio Mininni", "（Mixkit 免费音乐许可）", "",
        "{\\fs36}数据", "宇宙年龄约 138 亿年", "历史上出生过的人口约 1170 亿　美国人口咨询局（PRB）估算", "",
        "字体　思源宋体 Noto Serif SC（SIL OFL）",
    ]
    body = r"\N".join(credits)
    y0, y1 = 1120, -1150
    ev.append(f"Dialogue: 1,{ts(cr['start'])},{ts(cr['start'] + cr['dur'])},Cred,,0,0,0,,"
              f"{{\\move(960,{y0},960,{y1})\\fad(600,600)}}{body}")
    open(path, "w", encoding="utf-8").write(hdr + "\n".join(ev) + "\n")


# --------------------------------------------------------------------------- audio

SR = 48000


def decode(path, start=0.0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", path] + (["-t", f"{dur:.3f}"] if dur else []) + \
          ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    import numpy as np
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32).reshape(-1, 2).copy()


def build_audio(total, path):
    import numpy as np
    n = int(total * SR)
    vo = np.zeros((n, 2), np.float32)
    speech = []
    for b in B:
        if b.get("vo"):
            x = decode(f"vo/{b['vo']}.mp3") * 1.25
            i = int(b["vo_at"] * SR)
            vo[i:i + len(x)] += x[:n - i]
            speech.append(b["speech"])

    def fades(x, fin, fout):
        k = np.ones(len(x), np.float32)
        a, z = int(fin * SR), int(fout * SR)
        if a:
            k[:a] = np.linspace(0, 1, a) ** 2
        if z:
            k[-z:] = np.linspace(1, 0, z) ** 2
        return x * k[:, None]

    mus = np.zeros((n, 2), np.float32)
    # music A ("Echoes") from the top, fading out across the "turn" beat
    turn = next(b for b in B if b["tag"] == "turn")
    a_end = turn["start"] + turn["dur"] - 0.3
    a = fades(decode("src/music/188.mp3", 0, a_end), 0, a_end - (turn["start"] + 0.5)) * 0.55
    mus[:len(a)] += a
    # music B ("We Will Get It"), aligned so its section change lands on "是一种自由" in n25
    mb = next(b for b in B if b["tag"] == "musicB")
    off = MB_DROP - (drop_time() - mb["start"])
    b_start = mb["start"] + 0.3
    bb = fades(decode("src/music/598.mp3", off + 0.3, total - b_start), 3.5, 6.0) * 0.5
    i = int(b_start * SR)
    mus[i:i + len(bb)] += bb[:n - i]

    # ducking envelope: -11 dB under speech, smooth ramps, stays down across short gaps
    duck = 10 ** (-11 / 20)
    g = np.ones(n, np.float32)
    t = np.arange(n) / SR
    merged = []
    for s0, s1 in speech:
        if merged and s0 - merged[-1][1] < 1.6:
            merged[-1][1] = s1
        else:
            merged.append([s0, s1])
    for s0, s1 in merged:
        att, rel = 0.35, 0.9
        w = np.clip(np.minimum((t - (s0 - 0.25 - att)) / att, ((s1 + 0.6 + rel) - t) / rel), 0, 1)
        g = np.minimum(g, 1 - (1 - duck) * w)
    mus *= g[:, None]

    def wav(p, x):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-c:a", "pcm_f32le", p], input=x.astype(np.float32).tobytes(), check=True)

    wav("out/stem_music.wav", mus)
    wav("out/stem_vo.wav", vo)
    pre = path.replace(".wav", "_pre.wav")
    wav(pre, mus + vo)
    # measure, then apply plain gain + a true-peak limiter (keeps the music's dynamics)
    r = subprocess.run(["ffmpeg", "-v", "info", "-i", pre, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    integ = float(r[r.rindex("I:"):].split()[1])
    gain = -16.0 - integ
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", pre, "-af",
                    f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=4:release=80:level=disabled",
                    "-ar", str(SR), "-c:a", "pcm_s16le", path], check=True)
    print(f"loudness {integ:.2f} LUFS -> gain {gain:+.2f} dB", flush=True)
    return off


# --------------------------------------------------------------------------- assembly

def assemble(shots, total, audio, ass, out):
    w, h = (960, 540) if PREVIEW else (1920, 1080)
    inputs, filt = [], []
    for i, s in enumerate(shots):
        inputs += ["-i", s["path"]]
        filt.append(f"[{i}:v]scale={w}:{h},setsar=1,fps={FPS},format=yuv420p,settb=1/{FPS * 1000}[s{i}]")
    cur, t = "s0", shots[0]["dur"]
    for i, s in enumerate(shots[1:], 1):
        kind, d = s["tin"]
        o = f"x{i}"
        if kind == "cut":
            filt.append(f"[{cur}][s{i}]concat=n=2:v=1:a=0,settb=1/{FPS * 1000}[{o}]")
        else:
            filt.append(f"[{cur}][s{i}]xfade=transition={kind}:duration={d:.3f}:offset={t:.3f}[{o}]")
        cur = o
        t += s["dur"]
    fontsdir = os.path.join(ROOT, "fonts")
    filt.append(f"[{cur}]trim=0:{total:.3f},setpts=PTS-STARTPTS,fade=t=in:st=0:d=2.0,subtitles={ass}:fontsdir={fontsdir}[vout]")
    inputs += ["-i", audio]
    cmd = ["ffmpeg", "-y", "-v", "error", "-stats"] + inputs + [
        "-filter_complex", ";".join(filt), "-map", "[vout]", "-map", f"{len(shots)}:a",
        "-c:v", "libx264", "-preset", "veryfast" if PREVIEW else "medium", "-crf", "28" if PREVIEW else "20",
        "-maxrate", "7M", "-bufsize", "14M", "-pix_fmt", "yuv420p", "-r", str(FPS),
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{total:.3f}", out]
    subprocess.run(cmd, check=True)


def main():
    total = layout()
    shots = build_shots()
    t = 0.0
    for s in shots:
        s["start"] = t
        t += s["dur"]
    print(f"total {total:.2f}s ({int(total // 60)}:{total % 60:04.1f}), {len(shots)} shots", flush=True)
    for b in B:
        lab = b["vo"] or b["tag"]
        print(f"  {b['start']:7.2f}  {b['dur']:5.2f}  {lab}", flush=True)
    if "--plan" in sys.argv:
        return
    if "--audio" in sys.argv:
        os.makedirs("out", exist_ok=True)
        print(f"music B track offset {build_audio(total, 'out/mix.wav'):.1f}s")
        return
    render_all(shots)
    os.makedirs("out", exist_ok=True)
    write_ass(total, "out/subs.ass")
    off = build_audio(total, "out/mix.wav")
    print(f"music B track offset {off:.1f}s", flush=True)
    out = "out/preview.mp4" if PREVIEW else "out/零点二秒.mp4"
    assemble(shots, total, "out/mix.wav", "out/subs.ass", out)
    print("done", out, flush=True)


if __name__ == "__main__":
    main()
