#!/usr/bin/env python3
"""Serve the portable review package from its root, regardless of working directory."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8766)
parser.add_argument('--bind', default='127.0.0.1', help='Use 0.0.0.0 for review from a phone on your trusted LAN.')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
print(f'Studio: http://localhost:{args.port}/ui-workspace/index.html', flush=True)
print(f'UI kedua: http://localhost:{args.port}/ui-workspace/minimal.html', flush=True)
ThreadingHTTPServer((args.bind, args.port), handler).serve_forever()
