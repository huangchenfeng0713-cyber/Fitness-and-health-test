"""Build a single self-contained HTML file (works offline, double-click to open).
- bundles src/app.js (+ dynamically imported modules + three.js) with esbuild into one IIFE
- inlines every asset as a data URL in window.__ASSETS__ (images re-encoded as WebP to keep the file small)
usage: python tools/build.py [out.html]"""
import base64, io, json, os, re, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'keepsake.html')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bundle = os.path.join(ROOT, 'dist', 'app.bundle.js')
esb = os.path.join(ROOT, 'node_modules', '.bin', 'esbuild.cmd' if os.name == 'nt' else 'esbuild')
subprocess.run([esb, os.path.join(ROOT, 'src', 'app.js'), '--bundle', '--format=iife', '--minify', '--target=es2020',
                '--legal-comments=none', '--outfile=' + bundle], check=True, cwd=ROOT)
js = open(bundle, encoding='utf-8').read()

assets = {}
adir = os.path.join(ROOT, 'assets')
for dp, dn, fn in os.walk(adir):
    for f in fn:
        if '.before-' in f: continue
        p = os.path.join(dp, f)
        key = os.path.relpath(p, adir).replace('\\', '/')
        ext = f.lower().rsplit('.', 1)[-1]
        if ext in ('png', 'jpg', 'jpeg'):
            im = Image.open(p)
            has_alpha = im.mode in ('RGBA', 'LA') and im.getextrema()[-1][0] < 255
            buf = io.BytesIO()
            im.convert('RGBA' if has_alpha else 'RGB').save(buf, 'WEBP', lossless=True, quality=100, method=6)
            data, mime = buf.getvalue(), 'image/webp'
        elif ext == 'glb':
            data, mime = open(p, 'rb').read(), 'model/gltf-binary'
        elif ext == 'json':
            data, mime = json.dumps(json.load(open(p, encoding='utf-8')), separators=(',', ':'), ensure_ascii=False).encode('utf-8'), 'application/json'
        else:
            continue
        assets[key] = 'data:%s;base64,%s' % (mime, base64.b64encode(data).decode('ascii'))
        print('%-32s %8.1f KB' % (key, len(data) / 1024))

html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
html = re.sub(r'<script type="importmap">.*?</script>\s*', '', html, flags=re.S)
html = re.sub(r'<script type="module" src="./src/app.js[^"]*"></script>', lambda _m: 
                    '<script>window.__ASSETS__=' + json.dumps(assets, separators=(',', ':')) + ';</script>\n<script>' + js.replace('</script', '<\\/script') + '</script>', html)
open(OUT, 'w', encoding='utf-8').write(html)
print('written', OUT, '%.1f MB' % (os.path.getsize(OUT) / 1e6))
