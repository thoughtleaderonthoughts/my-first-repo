#!/usr/bin/env python3
"""Serve Bright Reads locally and open it in the default browser."""

from __future__ import annotations

import argparse
import contextlib
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preview Bright Reads locally.")
    parser.add_argument("--port", type=int, default=8000, help="Port to use (default: 8000)")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the server without opening a browser window",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    handler = lambda *handler_args, **kwargs: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *handler_args, directory=ROOT, **kwargs
    )
    url = f"http://localhost:{args.port}"

    with ReusableTCPServer(("", args.port), handler) as server:
        print(f"Bright Reads is ready at {url}")
        print("Press Ctrl+C to stop the preview server.")
        if not args.no_browser:
            threading.Timer(0.4, webbrowser.open, args=(url,)).start()
        with contextlib.suppress(KeyboardInterrupt):
            server.serve_forever()


if __name__ == "__main__":
    main()
