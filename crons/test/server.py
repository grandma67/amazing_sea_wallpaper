"""Fixture site for crons/test/run.sh.

Serves ROOT on 127.0.0.1 at a free port (written to PORT_FILE once listening) and appends every
request path (with its query) to LOG_FILE, opened per request so the runner can truncate it
between cases. A sidecar file `<name>.ctype` overrides the Content-Type of `<name>`, so a case can
serve HTML as `daily/pc/<date>.jpg`. Missing files are 404. Same headers the real site sends that
the script may read: Content-Type, Content-Length, Cache-Control.

usage: python3 -I server.py ROOT PORT_FILE LOG_FILE
"""

import http.server
import os
import sys
import urllib.parse

ROOT, PORT_FILE, LOG_FILE = sys.argv[1:4]

TYPES = {".jpg": "image/jpeg", ".json": "application/json", ".sh": "text/plain", ".ps1": "text/plain"}


class Handler(http.server.BaseHTTPRequestHandler):
    def _serve(self, body):
        with open(LOG_FILE, "a") as log:
            log.write(f"{self.command} {self.path}\n")
        rel = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).lstrip("/")
        path = os.path.normpath(os.path.join(ROOT, rel))
        if not path.startswith(os.path.abspath(ROOT)) or not os.path.isfile(path) or path.endswith(".ctype"):
            self.send_response(404)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", "9")
            self.end_headers()
            if body:
                self.wfile.write(b"not found")
            return
        try:
            with open(path + ".ctype") as f:
                ctype = f.read().strip()
        except FileNotFoundError:
            ctype = TYPES.get(os.path.splitext(path)[1], "application/octet-stream")
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=600")
        self.end_headers()
        if body:
            self.wfile.write(data)

    def do_GET(self):
        self._serve(True)

    def do_HEAD(self):
        self._serve(False)

    def log_message(self, *args):
        pass


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
with open(PORT_FILE + ".tmp", "w") as f:
    f.write(str(server.server_address[1]))
os.replace(PORT_FILE + ".tmp", PORT_FILE)
server.serve_forever()
