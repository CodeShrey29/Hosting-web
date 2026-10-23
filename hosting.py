#!/usr/bin/env python3
"""
Cloud Host — Local PC / Render entry point
Start with: python hosting.py
"""

import os
import sys
from pathlib import Path

try:
    from flask import Flask, send_from_directory, jsonify
except ImportError:
    print("Installing Flask...")
    os.system(f"{sys.executable} -m pip install -q flask")
    from flask import Flask, send_from_directory, jsonify

BASE = Path(__file__).parent
DIST = BASE / "frontend" / "dist"

app = Flask(__name__, static_folder=str(DIST), static_url_path="")

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "mode": "local-pc",
        "message": "Running on this machine. All data stays local."
    })

@app.route("/api/status")
def status():
    return jsonify({
        "worker": "healthy",
        "mode": "Local PC",
        "docker": "ready",
        "ram": "local",
        "storage": "internal disk"
    })

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    target = DIST / path
    if path and target.exists() and target.is_file():
        return send_from_directory(DIST, path)
    index = DIST / "index.html"
    if index.exists():
        return send_from_directory(DIST, "index.html")
    return (
        "Frontend not built yet.\n\n"
        "On your PC run:\n"
        "  cd frontend && npm install && npm run build && cd ..\n"
        "  python hosting.py\n\n"
        "On Render the build command handles this automatically.",
        404,
        {"Content-Type": "text/plain"},
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Cloud Host starting on http://0.0.0.0:{port}")
    print("Mode: Local PC (everything stays on this machine)")
    app.run(host="0.0.0.0", port=port, debug=False)
