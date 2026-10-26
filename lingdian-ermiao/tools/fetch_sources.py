"""Download the source media that build.py expects (clips, stills, music, fonts).

Raw media is not kept in the repo: Mixkit's licence does not allow redistributing clips on their own,
and the NASA 4K reels are ~2 GB each. Run from the lingdian-ermiao/ folder: python3 tools/fetch_sources.py
"""
import json
import os
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0"}
BUILD = open("build.py", encoding="utf-8").read()


def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 100_000:
        return True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=900) as r, open(path, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        print("ok  ", path)
        return True
    except Exception as e:  # noqa: BLE001 - report and continue with the next file
        print("fail", path, e)
        if os.path.exists(path):
            os.remove(path)
        return False


# Mixkit clips (1080p when offered, otherwise 720p)
for mid in sorted(set(re.findall(r"mk\((\d+)\)", BUILD)), key=int):
    base = f"https://assets.mixkit.co/videos/{mid}/{mid}"
    get(f"{base}-1080.mp4", f"src/mk/{mid}.mp4") or get(f"{base}-720.mp4", f"src/mk/{mid}.mp4")

# NASA video (images.nasa.gov, "large" rendition)
NASA = {"earth4k_2021": "jsc2021m000138_4K_Earth_Views_Extended_Cut_for_Earth_Day_ 2021_210422-4KMP4",
        "earth4k_2023": "jsc2023m000111_Earth_in_4K_Space_Station_Expedition_67_68_Edition",
        "orion_lookback": "ART-DL-1_2022_326_1226_SHARED_art001m1013261226"}
for name, nid in NASA.items():
    q = nid.replace(" ", "%20")
    get(f"https://images-assets.nasa.gov/video/{q}/{q}~large.mp4", f"src/nasa/{name}.mp4")

# NASA stills
get("https://images-assets.nasa.gov/image/PIA23645/PIA23645~orig.jpg", "src/img/palebluedot_2020.jpg")
get("https://images-assets.nasa.gov/image/webb_first_deep_field/webb_first_deep_field~orig.png", "src/img/webb_deep.png")

# Prelinger Archives amateur films (public domain)
for ident in sorted(set(re.findall(r'ia\("([A-Za-z0-9_]+)"\)', BUILD))):
    meta = json.load(urllib.request.urlopen(f"https://archive.org/metadata/{ident}", timeout=60))
    mp4 = next(f["name"] for f in meta["files"] if f["name"].endswith(".mp4") and ".ia." not in f["name"])
    get(f"https://archive.org/download/{ident}/{mp4}", f"src/ia/{ident}.mp4")

# Music (Mixkit): 188 "Echoes" by Andrew Ev, 598 "We Will Get It" by Eugenio Mininni
for mid in ("188", "598"):
    get(f"https://assets.mixkit.co/music/{mid}/{mid}.mp3", f"src/music/{mid}.mp3")

# Fonts: Noto Serif SC (SIL OFL)
for w in ("Light", "Regular", "SemiBold"):
    get(f"https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/SubsetOTF/SC/NotoSerifSC-{w}.otf",
        f"fonts/NotoSerifSC-{w}.otf")
