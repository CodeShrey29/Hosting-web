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
    from flask import Flask, send_from_directory, session, jsonify
    from flask_cors import CORS
except ImportError:
    print("Installing Python dependencies...")
    os.system(f"{sys.executable} -m pip install -q -r requirements.txt")
    from flask import Flask, send_from_directory, session, jsonify
    from flask_cors import CORS

from backend.db import init_db
from backend.api import api

BASE = Path(__file__).parent
FRONTEND = BASE / "frontend"
DIST = FRONTEND / "dist"

def ensure_frontend():
    if (DIST / "index.html").exists():
        print("Frontend found.")
        return True
    print("Frontend not built. Attempting auto-build...")
    if not (FRONTEND / "package.json").exists():
        print("No frontend source found.")
        return False
    try:
        if not (FRONTEND / "node_modules").exists():
            print("Running npm install...")
            subprocess.check_call(["npm", "install"], cwd=FRONTEND)
        print("Running npm run build...")
        subprocess.check_call(["npm", "run", "build"], cwd=FRONTEND)
        print("Frontend build complete.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Auto-build skipped (Node.js not available): {e}")
        return False

app = Flask(__name__, static_folder=str(DIST) if DIST.exists() else None, static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "local-pc-session-key")
CORS(app, supports_credentials=True)
app.register_blueprint(api)

FALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cloud Host — Local PC</title>
<style>
body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px; }
.card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; }
h1 { margin-top: 0; }
a { color: #60a5fa; }
.ok { color: #4ade80; }
pre { background: #0f172a; padding: 12px; border-radius: 8px; overflow-x: auto; }
</style>
</head>
<body>
<div class="card">
<h1>Cloud Host</h1>
<p class="ok">Backend is running (Local PC mode)</p>
<p>The React frontend is not built yet.</p>
<p>API is available:</p>
<ul>
<li><a href="/api/health">/api/health</a></li>
<li><a href="/api/status">/api/status</a></li>
<li><a href="/api/projects">/api/projects</a></li>
<li><a href="/api/plans">/api/plans</a></li>
</ul>
<p>To get the full UI, either:</p>
<pre>cd frontend && npm install && npm run build</pre>
<p>Or pull the latest repo (pre-built dist will be included soon).</p>
</div>
</body>
</html>"""

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if DIST.exists() and (DIST / "index.html").exists():
        target = DIST / path
        if path and target.exists() and target.is_file():
            return send_from_directory(DIST, path)
        return send_from_directory(DIST, "index.html")
    # Fallback when frontend not built
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    return FALLBACK_HTML, 200, {"Content-Type": "text/html"}

if __name__ == "__main__":
    ensure_frontend()
    init_db()
    port = int(os.environ.get("PORT", 5000))
    print(f"\nCloud Host running at http://0.0.0.0:{port}")
    print("Mode: Local PC")
    if not (DIST / "index.html").exists():
        print("Note: Serving fallback page (frontend not built)")
    app.run(host="0.0.0.0", port=port, debug=False)
