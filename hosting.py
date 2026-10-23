#!/usr/bin/env python3
"""
Cloud Host — Local PC entry point
Just run: python hosting.py
"""

import os
import sys
import subprocess
from pathlib import Path

try:
    from flask import Flask, send_from_directory
    from flask_cors import CORS
except ImportError:
    print("Installing Python dependencies...")
    os.system(f"{sys.executable} -m pip install -q -r requirements.txt")
    from flask import Flask, send_from_directory
    from flask_cors import CORS

from backend.db import init_db
from backend.api import api

BASE = Path(__file__).parent
FRONTEND = BASE / "frontend"
DIST = FRONTEND / "dist"

def ensure_frontend():
    """Build frontend automatically if missing."""
    if (DIST / "index.html").exists():
        return True

    print("Frontend not built. Building now (first time only)...")
    if not (FRONTEND / "package.json").exists():
        print("frontend/package.json missing. Skipping build.")
        return False

    try:
        # Install deps if node_modules missing
        if not (FRONTEND / "node_modules").exists():
            print("Running npm install...")
            subprocess.check_call(["npm", "install"], cwd=FRONTEND)
        print("Running npm run build...")
        subprocess.check_call(["npm", "run", "build"], cwd=FRONTEND)
        print("Frontend build complete.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Auto-build failed: {e}")
        print("Make sure Node.js and npm are installed, then run once:")
        print("  cd frontend && npm install && npm run build")
        return False

app = Flask(__name__, static_folder=str(DIST), static_url_path="")
CORS(app)
app.register_blueprint(api)

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
        "Frontend build missing and auto-build failed.\n"
        "Install Node.js, then restart: python hosting.py",
        404,
        {"Content-Type": "text/plain"},
    )

if __name__ == "__main__":
    ensure_frontend()
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"\nCloud Host running at http://0.0.0.0:{port}")
    print("Mode: Local PC (SQLite + Docker on this machine)")
    app.run(host="0.0.0.0", port=port, debug=False)
