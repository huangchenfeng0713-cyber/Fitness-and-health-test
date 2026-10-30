"""Local QA artifact sink. Accepts only localhost POSTs into dev/qa-output."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import base64
ROOT = Path(__file__).resolve().parent / 'qa-output'
ROOT.mkdir(exist_ok=True)
class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204); self.headers_out()
    def headers_out(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    def do_POST(self):
        name = Path(parse_qs(urlparse(self.path).query).get('name', ['result.json'])[0]).name
        data = self.rfile.read(min(int(self.headers.get('Content-Length', 0)), 100000000))
        if data.startswith(b'data:'): data = base64.b64decode(data.split(b',', 1)[1])
        (ROOT / name).write_bytes(data)
        self.send_response(200); self.headers_out(); self.wfile.write(b'ok')
    def log_message(self, *args): pass
ThreadingHTTPServer(('127.0.0.1', 8876), Handler).serve_forever()
