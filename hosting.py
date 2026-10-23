#!/usr/bin/env python3
"""
Cloud Host — Local PC / Render entry point
Run with: python hosting.py
"""

import os
import sys
from pathlib import Path

# Simple static server that works on PC and Render
try:
    from flask import Flask, send_from_directory, jsonify
except ImportError:
    print("Flask not installed. Installing...")
    os.system(f"{sys.executable} -m pip install flask")
    from flask import Flask, send_from_directory, jsonify

app = Flask(__name__, static_folder="frontend/dist", static_url_path="")

DIST = Path(__file__).parent / "frontend" / "dist"

@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "mode": "local-pc",
        "message": "Running on this machine. No external services."
    })

@app.route("/api/status")
def status():
    return jsonify({
        "worker": "healthy",
        "mode": "Local PC",
        "docker": "ready",
        "ram": "local",
        "storage": "local disk"
    })

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path and (DIST / path).exists():
        return send_from_directory(DIST, path)
    # SPA fallback
    index = DIST / "index.html"
    if index.exists():
        return send_from_directory(DIST, "index.html")
    return "Frontend not built. Run: cd frontend && npm install && npm run build", 404

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Cloud Host on http://0.0.0.0:{port}")
    print("Mode: Local PC (everything stays on this machine)")
    app.run(host="0.0.0.0", port=port, debug=False)
