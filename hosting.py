#!/usr/bin/env python3
"""
Cloud Host — Local PC entry point
Start with: python hosting.py
"""

import os
import sys
from pathlib import Path

try:
    from flask import Flask, send_from_directory
    from flask_cors import CORS
except ImportError:
    print("Installing dependencies...")
    os.system(f"{sys.executable} -m pip install -q -r requirements.txt")
    from flask import Flask, send_from_directory
    from flask_cors import CORS

from backend.db import init_db
from backend.api import api

BASE = Path(__file__).parent
DIST = BASE / "frontend" / "dist"

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
        "Frontend not built.\n\n"
        "Run: cd frontend && npm install && npm run build && cd .. && python hosting.py",
        404,
        {"Content-Type": "text/plain"},
    )

if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"Cloud Host starting on http://0.0.0.0:{port}")
    print("Mode: Local PC — SQLite + Docker on this machine")
    app.run(host="0.0.0.0", port=port, debug=False)
