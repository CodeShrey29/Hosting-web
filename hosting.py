#!/usr/bin/env python3
"""
Cloud Host control-plane entry point
Run with: python hosting.py
"""

import os
import re
import secrets
import subprocess
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

from backend.db import init_db
from backend.api import (
    admin_auth_configured,
    api,
    auth_required,
    get_deployment_mode,
    persistent_storage_available,
)

BASE = Path(__file__).parent
FRONTEND = BASE / "frontend"
DIST = FRONTEND / "dist"

def ensure_frontend():
    index_path = DIST / "index.html"
    if index_path.exists():
        html = index_path.read_text(encoding="utf-8")
        referenced_assets = re.findall(r'''(?:src|href)=["']/?(assets/[^"']+)["']''', html)
        if referenced_assets and all((DIST / asset).is_file() for asset in referenced_assets):
            print("Frontend found.")
            return True
        print("Frontend build assets are missing. Rebuilding from source.")
    print("Frontend not built. Attempting auto-build...")
    if not (FRONTEND / "package.json").exists():
        print("No frontend source found.")
        return False
    try:
        if not (FRONTEND / "node_modules").exists():
            print("Installing frontend dependencies...")
            subprocess.check_call(["npm", "ci"], cwd=FRONTEND)
        print("Running npm run build...")
        subprocess.check_call(["npm", "run", "build"], cwd=FRONTEND)
        print("Frontend build complete.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"Auto-build skipped (Node.js not available): {e}")
        return False


def get_secret_key():
    secret_key = os.environ.get("SECRET_KEY", "").strip()
    if secret_key:
        return secret_key
    if get_deployment_mode() != "render":
        return secrets.token_hex(32)
    if not persistent_storage_available():
        raise RuntimeError(
            "SECRET_KEY is missing and persistent storage is unavailable. "
            "Set SECRET_KEY in the Render environment or configure the persistent disk."
        )

    key_path = Path(os.environ.get("DATA_DIR", BASE / "data")) / ".flask_secret_key"
    try:
        descriptor = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    except OSError as error:
        raise RuntimeError("Could not create the persistent Flask secret key.") from error
    else:
        with os.fdopen(descriptor, "w", encoding="ascii") as key_file:
            key_file.write(secrets.token_hex(32))
            key_file.flush()
            os.fsync(key_file.fileno())

    try:
        file_stat = key_path.lstat()
        if not key_path.is_file() or key_path.is_symlink():
            raise RuntimeError("The persistent Flask secret key path is not a regular file.")
        if file_stat.st_mode & 0o077:
            key_path.chmod(0o600)
        secret_key = key_path.read_text(encoding="ascii").strip()
    except OSError as error:
        raise RuntimeError("Could not read the persistent Flask secret key.") from error
    if len(secret_key) < 64:
        raise RuntimeError("The persistent Flask secret key is missing or invalid.")
    return secret_key


app = Flask(__name__, static_folder=str(DIST) if DIST.exists() else None, static_url_path="")
render_mode = get_deployment_mode() == "render"
if auth_required() and not admin_auth_configured():
    raise RuntimeError(
        "The control plane is exposed but administrator credentials are missing or invalid. "
        "Configure ADMIN_EMAIL and an ADMIN_PASSWORD with at least 16 characters."
    )
app.secret_key = get_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=auth_required(),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 12,
    MAX_CONTENT_LENGTH=50 * 1024 * 1024,
)
if render_mode:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.register_blueprint(api)
init_db()

@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Content-Security-Policy", (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; connect-src 'self'; object-src 'none'; "
        "base-uri 'self'; frame-ancestors 'none'"
    ))
    if auth_required():
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    if request.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response

FALLBACK_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cloud Host — Control plane</title>
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
<p class="ok">Backend is running</p>
<p>The React frontend is not built yet.</p>
<p>API is available:</p>
<ul>
<li><a href="/api/health">/api/health</a></li>
<li><a href="/api/status">/api/status</a></li>
<li><a href="/api/projects">/api/projects</a></li>
<li><a href="/api/plans">/api/plans</a></li>
</ul>
<p>To get the full UI, either:</p>
<pre>cd frontend && npm ci && npm run build</pre>
<p>Check the server logs if the frontend build fails.</p>
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
    port = int(os.environ.get("PORT", 5000))
    host = "0.0.0.0" if render_mode else os.environ.get("HOSTING_HOST", "127.0.0.1")
    print(f"\nCloud Host running at http://{host}:{port}")
    print(f"Mode: {get_deployment_mode()}")
    if not (DIST / "index.html").exists():
        print("Note: Serving fallback page (frontend not built)")
    app.run(host=host, port=port, debug=False)
