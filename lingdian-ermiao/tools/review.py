"""Sample one frame per N seconds of a video into labelled contact sheets: review.py video step out_prefix"""
import math, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont
video, step, prefix = sys.argv[1], float(sys.argv[2]), sys.argv[3]
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], capture_output=True, text=True).stdout)
tmp = prefix + "_frames"; os.makedirs(tmp, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"fps=1/{step},scale=320:-2", f"{tmp}/f_%04d.jpg"], check=True)
files = sorted(os.listdir(tmp))
font = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 14)
W, H, cols, per = 320, 180, 5, 40
for p in range(math.ceil(len(files) / per)):
    chunk = files[p * per:(p + 1) * per]; rows = math.ceil(len(chunk) / cols)
    sheet = Image.new("RGB", (cols * W, rows * (H + 16)), "black"); d = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x, y = (i % cols) * W, (i // cols) * (H + 16)
        sheet.paste(Image.open(f"{tmp}/{f}"), (x, y))
        t = (p * per + i) * step
        d.text((x + 2, y + H), f"{int(t // 60)}:{t % 60:04.1f}", fill="yellow", font=font)
    sheet.save(f"{prefix}_{p}.jpg", quality=82); print(f"{prefix}_{p}.jpg")
