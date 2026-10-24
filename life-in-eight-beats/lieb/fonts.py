"""Pick a CJK-capable font family on Linux / macOS / Windows (override with LIEB_FONT)."""
import os
import shutil
import subprocess
import sys

_CACHE = {}

CANDIDATES = {
    'darwin': ['PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'STHeiti'],
    'win32': ['Microsoft YaHei', 'SimHei', 'DengXian'],
    'linux': ['Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Zen Hei', 'WenQuanYi Micro Hei',
              'Droid Sans Fallback', 'AR PL UMing CN'],
}


def cjk_font():
    if 'f' in _CACHE:
        return _CACHE['f']
    env = os.environ.get('LIEB_FONT')
    if env:
        _CACHE['f'] = env
        return env
    plat = 'darwin' if sys.platform == 'darwin' else 'win32' if sys.platform.startswith('win') else 'linux'
    cands = CANDIDATES[plat]
    pick = cands[0]
    if plat == 'linux' and shutil.which('fc-list'):
        try:
            out = subprocess.run(['fc-list', ':lang=zh', 'family'], capture_output=True, text=True, timeout=10).stdout
            have = set()
            for line in out.splitlines():
                for name in line.split(','):
                    have.add(name.strip())
            for c in cands:
                if c in have:
                    pick = c
                    break
        except Exception:
            pass
    _CACHE['f'] = pick
    return pick
