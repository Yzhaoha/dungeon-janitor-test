#!/usr/bin/env python3
"""Tiny local server for tools/cover.html: serves the repo and saves POST /save?name=x.png into covers/.
Run from the repo root: python3 tools/save_server.py 8794"""
import http.server, os, re, sys, urllib.parse
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_POST(s):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(s.path).query)
        name = q.get('name', [''])[0]
        if not re.fullmatch(r'[\w.-]+\.(png|jpg)', name): s.send_error(400); return
        data = s.rfile.read(int(s.headers['Content-Length']))
        os.makedirs(os.path.join(ROOT, 'covers'), exist_ok=True)
        open(os.path.join(ROOT, 'covers', name), 'wb').write(data)
        s.send_response(200); s.end_headers(); s.wfile.write(b'ok')
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8794), H).serve_forever()
