"""Compare final HTML assets with source bytes / decoded pixels (WebP is lossless)."""
from pathlib import Path
import base64
import hashlib
import io
import json
import re
from PIL import Image, ImageChops
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
html = ROOT / 'dist/keepsake.html'
match = re.search(r'<script>window\.__ASSETS__=(.*?);</script>', html.read_text(), re.S)
assert match, 'Embedded asset manifest missing'
assets = json.loads(match.group(1))
report = {'html_sha256': hashlib.sha256(html.read_bytes()).hexdigest(), 'checks': []}
for name, uri in sorted(assets.items()):
    header, payload = uri.split(',', 1)
    embedded = base64.b64decode(payload)
    source = (ROOT / 'assets' / name).read_bytes()
    row = {'name': name, 'source_sha256': hashlib.sha256(source).hexdigest(),
           'embedded_sha256': hashlib.sha256(embedded).hexdigest(),
           'embedded_mime': header[5:].split(';')[0]}
    if name.lower().endswith(('.png', '.jpg', '.jpeg')):
        original = Image.open(io.BytesIO(source)).convert('RGBA')
        decoded = Image.open(io.BytesIO(embedded)).convert('RGBA')
        row['size'] = list(original.size)
        row['comparison'] = 'decoded visible RGB and alpha; exact RGBA match reported separately'
        row['source_pixel_sha256'] = hashlib.sha256(original.tobytes()).hexdigest()
        row['embedded_pixel_sha256'] = hashlib.sha256(decoded.tobytes()).hexdigest()
        row['exact_rgba_match'] = original.size == decoded.size and original.tobytes() == decoded.tobytes()
        # WebP's lossless encoder may canonicalize RGB beneath fully transparent
        # pixels; visible RGB and alpha must still be identical.
        left, right = np.asarray(original), np.asarray(decoded)
        same_size = original.size == decoded.size
        if same_size:
            different = np.any(left != right, axis=2)
            visible = (left[:, :, 3] > 0) | (right[:, :, 3] > 0)
            row['different_transparent_pixels'] = int(np.count_nonzero(different & ~visible))
            row['different_visible_pixels'] = int(np.count_nonzero(different & visible))
            row['pass'] = row['different_visible_pixels'] == 0
        else:
            row['pass'] = False
        if original.size == decoded.size:
            row['max_channel_error'] = max(hi for lo, hi in ImageChops.difference(original, decoded).getextrema())
    elif name.endswith('.json'):
        row['comparison'] = 'parsed JSON (build removes whitespace)'
        row['pass'] = json.loads(source) == json.loads(embedded)
    else:
        row['comparison'] = 'exact bytes'
        row['pass'] = source == embedded
    report['checks'].append(row)
    print(('PASS' if row['pass'] else 'FAIL'), name, row['comparison'])
out = ROOT / 'verification/embedded-assets.json'
out.write_text(json.dumps(report, indent=2) + '\n')
assert all(c['pass'] for c in report['checks']), 'Embedded assets differ from source'
print('Verified', len(report['checks']), 'embedded assets; report:', out)
