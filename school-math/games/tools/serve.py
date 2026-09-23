#!/usr/bin/env python3
"""Local dev server for the site: `python3 -m http.server`, but every response carries
`Cache-Control: no-cache`, so the browser revalidates edited files instead of reusing stale copies.

Why: the plain server sends no cache headers, so Chrome kept a stale engine module (assets.js)
beside a fresh one (ui.js). The import failed and a game stayed on a black screen. Cloudflare
already sends `max-age=0, must-revalidate` on the live site; this makes local match.

Usage, from the repo root: python3 school-math/games/tools/serve.py [port]   (default 8753)
It serves the current directory, like http.server.
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8753
    print(f'serving {port} with Cache-Control: no-cache', flush=True)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
