import hmac
import hashlib
import ipaddress
import math
import os
import re
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_file, session
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from . import docker_worker
from .db import (
    DATA_DIR,
    UPLOADS_DIR,
    VOLUMES_DIR,
    dict_from_row,
    get_db,
    get_plan,
    get_user_usage,
)
from .templates import get_template, list_templates

api = Blueprint("api", __name__, url_prefix="/api")
PROJECT_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,47}$")
PUBLIC_ENDPOINTS = {"/api/health", "/api/auth/me", "/api/auth/login", "/api/auth/register"}
WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
EMAIL_ADDRESS = re.compile(r"^[^@\s]{1,64}@[^@\s.]+(?:\.[^@\s.]+)+$")


def get_deployment_mode():
    return "render" if os.environ.get("RENDER", "").lower() == "true" else "local-pc"

def auth_required():
    if get_deployment_mode() == "render" or os.environ.get("HOSTING_REQUIRE_AUTH", "").lower() == "true":
        return True
    try:
        return not ipaddress.ip_address(os.environ.get("HOSTING_HOST", "127.0.0.1")).is_loopback
    except ValueError:
        return True

def admin_auth_configured():
    return bool(os.environ.get("ADMIN_EMAIL") and len(os.environ.get("ADMIN_PASSWORD", "")) >= 16)

def admin_auth_version():
    return hmac.new(
        str(current_app.secret_key).encode(),
        os.environ["ADMIN_PASSWORD"].encode(),
        hashlib.sha256,
    ).hexdigest()

def persistent_storage_available():
    return (
        get_deployment_mode() != "render"
        or (
            os.environ.get("PERSISTENT_STORAGE", "").lower() == "true"
            and DATA_DIR.is_mount()
        )
    )

def current_identity():
    role = session.get("role")
    if role == "admin":
        if not admin_auth_configured() or not hmac.compare_digest(
            session.get("auth_version", ""), admin_auth_version()
        ):
            return None
        return {"role": "admin", "email": os.environ["ADMIN_EMAIL"]}
    if role == "customer":
        user_id = session.get("user_id")
        if not isinstance(user_id, int):
            return None
        conn = get_db()
        try:
            user = conn.execute(
                "SELECT id, email, status FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        finally:
            conn.close()
        if not user or user["status"] != "active":
            return None
        return {"role": "customer", "id": user["id"], "email": user["email"]}
    return None

def current_user_id():
    identity = current_identity()
    return identity["id"] if identity and identity["role"] == "customer" else 1

def establish_session(role, email, csrf_token=None, user_id=None):
    session.clear()
    session.permanent = True
    session["role"] = role
    session["email"] = email
    session["csrf_token"] = csrf_token or uuid.uuid4().hex
    if role == "admin":
        session["auth_version"] = admin_auth_version()
    else:
        session["user_id"] = user_id


def api_error(message, status):
    return jsonify({"error": message}), status


@api.before_app_request
def protect_api():
    if not request.path.startswith("/api/"):
        return None
    if request.path in PUBLIC_ENDPOINTS:
        return None
    if auth_required() and not admin_auth_configured():
        return api_error("The control plane is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.", 503)
    admin_endpoint = (
        request.path.startswith("/api/admin/")
        or request.path == "/api/docker/containers"
    )
    identity = current_identity()
    if admin_endpoint:
        if not identity:
            return api_error("Authentication required.", 401)
        if identity["role"] != "admin":
            return api_error("Administrator access required.", 403)
    if not identity and not auth_required() and not session.get("role"):
        return None
    if not identity:
        return api_error("Authentication required.", 401)
    if not admin_endpoint and identity["role"] == "admin" and request.path != "/api/auth/logout":
        return api_error("Customer account access required.", 403)
    if request.method in WRITE_METHODS:
        supplied = request.headers.get("X-CSRF-Token", "")
        expected = session.get("csrf_token", "")
        if not supplied or not expected or not hmac.compare_digest(supplied, expected):
            return api_error("CSRF validation failed. Refresh the page and try again.", 403)
    return None


@api.route("/health")
def health():
    mode = get_deployment_mode()
    conn = get_db()
    try:
        conn.execute("SELECT 1").fetchone()
    except Exception:
        current_app.logger.exception("Database health check failed.")
        return api_error("Control-plane database is unavailable.", 503)
    finally:
        conn.close()
    return jsonify({
        "status": "ok",
        "mode": mode,
        "storage": "persistent" if persistent_storage_available() else "ephemeral",
        "auth_configured": not auth_required() or admin_auth_configured(),
        "database": "available",
    })


@api.route("/auth/me")
def me():
    identity = current_identity()
    if identity:
        return jsonify({
            "authenticated": True,
            "email": identity["email"],
            "role": identity["role"],
            "mode": get_deployment_mode(),
            "csrf_token": session.get("csrf_token"),
            "auth_required": True,
        })
    if auth_required() and not admin_auth_configured():
        return jsonify({
            "authenticated": False,
            "mode": get_deployment_mode(),
            "auth_required": True,
            "configuration_error": "Set ADMIN_EMAIL and an ADMIN_PASSWORD with at least 16 characters to enable the protected control plane.",
        }), 503
    return jsonify({
        "authenticated": False,
        "mode": get_deployment_mode(),
        "auth_required": auth_required(),
    })


@api.route("/auth/login", methods=["POST"])
def login():
    if auth_required() and not admin_auth_configured():
        return api_error("Set ADMIN_EMAIL and an ADMIN_PASSWORD with at least 16 characters in the service environment before signing in.", 503)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error("Send a JSON object with email and password.", 400)
    email = data.get("email", "")
    password = data.get("password", "")
    if not isinstance(email, str) or not isinstance(password, str):
        return api_error("Email and password must be strings.", 400)

    client_ip = request.remote_addr or "unknown"
    client_key = hmac.new(
        str(current_app.secret_key).encode(),
        client_ip.encode(),
        hashlib.sha256,
    ).hexdigest()
    conn = get_db()
    try:
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(minutes=15)).isoformat()
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM auth_login_attempts WHERE attempted_at < ?", (cutoff,))
        attempts = conn.execute(
            "SELECT COUNT(*) AS count FROM auth_login_attempts WHERE client_key = ?",
            (client_key,),
        ).fetchone()["count"]
        if attempts >= 5:
            conn.commit()
            return api_error("Too many sign-in attempts. Try again in 15 minutes.", 429)
        configured_email = os.environ.get("ADMIN_EMAIL", "")
        is_admin = bool(
            admin_auth_configured()
            and hmac.compare_digest(email.strip().casefold(), configured_email.strip().casefold())
            and hmac.compare_digest(password, os.environ["ADMIN_PASSWORD"])
        )
        user = None
        if not is_admin:
            user = conn.execute(
                "SELECT id, email, password_hash FROM users "
                "WHERE email = ? COLLATE NOCASE AND status = 'active'",
                (email.strip(),),
            ).fetchone()
        customer_matches = bool(
            user and user["password_hash"] and check_password_hash(user["password_hash"], password)
        )
        if not (is_admin or customer_matches):
            conn.execute(
                "INSERT INTO auth_login_attempts (client_key, attempted_at) VALUES (?, ?)",
                (client_key, now.isoformat()),
            )
            conn.commit()
            return api_error("Invalid email or password.", 401)
        conn.execute("DELETE FROM auth_login_attempts WHERE client_key = ?", (client_key,))
        conn.commit()
    finally:
        conn.close()

    role = "admin" if is_admin else "customer"
    establish_session(
        role,
        configured_email if is_admin else user["email"],
        user_id=None if is_admin else user["id"],
    )
    return jsonify({
        "authenticated": True,
        "email": session["email"],
        "role": role,
        "mode": get_deployment_mode(),
        "auth_required": True,
        "csrf_token": session["csrf_token"],
    })

@api.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error("Send a JSON object with email and password.", 400)
    email = data.get("email")
    password = data.get("password")
    if not isinstance(email, str) or not isinstance(password, str):
        return api_error("Email and password must be strings.", 400)
    email = email.strip().casefold()
    if len(email) > 254 or not EMAIL_ADDRESS.fullmatch(email):
        return api_error("Enter a valid email address.", 400)
    if len(password) < 12 or len(password) > 128:
        return api_error("Password must be between 12 and 128 characters.", 400)
    if (
        os.environ.get("ADMIN_EMAIL")
        and hmac.compare_digest(email, os.environ["ADMIN_EMAIL"].strip().casefold())
    ):
        return api_error("This email address is reserved for the administrator.", 409)

    client_ip = request.remote_addr or "unknown"
    client_key = hmac.new(
        str(current_app.secret_key).encode(), client_ip.encode(), hashlib.sha256
    ).hexdigest()
    conn = get_db()
    try:
        now = datetime.now(timezone.utc)
        cutoff = (now - timedelta(minutes=15)).isoformat()
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM auth_login_attempts WHERE attempted_at < ?", (cutoff,))
        attempts = conn.execute(
            "SELECT COUNT(*) AS count FROM auth_login_attempts WHERE client_key = ?",
            (client_key,),
        ).fetchone()["count"]
        if attempts >= 5:
            conn.commit()
            return api_error("Too many account attempts. Try again in 15 minutes.", 429)
        conn.execute(
            "INSERT INTO auth_login_attempts (client_key, attempted_at) VALUES (?, ?)",
            (client_key, now.isoformat()),
        )
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ? COLLATE NOCASE", (email,)
        ).fetchone()
        if existing:
            conn.commit()
            return api_error("An account with this email already exists.", 409)
        password_hash = generate_password_hash(password)
        cursor = conn.execute(
            "INSERT INTO users (email, name, plan_id, created_at, password_hash, status) "
            "VALUES (?, ?, 1, ?, ?, 'active')",
            (email, email.split("@", 1)[0], now.isoformat(), password_hash),
        )
        user_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    establish_session("customer", email, user_id=user_id)
    return jsonify({
        "authenticated": True,
        "email": email,
        "role": "customer",
        "mode": get_deployment_mode(),
        "auth_required": True,
        "csrf_token": session["csrf_token"],
    }), 201

@api.route("/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"authenticated": True})


@api.route("/status")
def status():
    mode = get_deployment_mode()
    user_id = current_user_id()
    conn = get_db()
    try:
        worker = dict_from_row(conn.execute("SELECT * FROM workers WHERE id = 1").fetchone())
        if mode == "render":
            worker = {
                "name": "No worker enrolled",
                "status": "unavailable",
                "total_ram_mb": None,
                "reserved_ram_mb": None,
                "total_cpu": None,
                "reserved_cpu": None,
                "total_storage_mb": None,
                "reserved_storage_mb": None,
                "last_seen": None,
            }
        projects = conn.execute("SELECT COUNT(*) AS c FROM projects WHERE user_id = ?", (user_id,)).fetchone()["c"]
        account = conn.execute("SELECT plan_id FROM users WHERE id = ?", (user_id,)).fetchone()
        plan = get_plan(account["plan_id"] if account else 1, conn)
        usage = get_user_usage(user_id, conn)
        return jsonify({
            "worker": worker,
            "docker": docker_worker.get_docker_info() if mode != "render" else {"available": False},
            "projects": projects,
            "plan": plan,
            "usage": usage,
            "mode": mode,
            "storage": "persistent" if persistent_storage_available() else "ephemeral",
        })
    finally:
        conn.close()


@api.route("/templates")
def templates():
    return jsonify(list_templates())


@api.route("/plans")
def list_plans_route():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM plans ORDER BY id").fetchall()
        return jsonify([dict(row) for row in rows])
    finally:
        conn.close()


@api.route("/projects", methods=["GET"])
def list_projects():
    user_id = current_user_id()
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name, type, status, ram_mb, cpu_limit, storage_mb, host_port, created_at "
            "FROM projects WHERE user_id = ? ORDER BY created_at DESC, id DESC",
            (user_id,),
        ).fetchall()
        return jsonify([dict(row) for row in rows])
    finally:
        conn.close()


@api.route("/projects", methods=["POST"])
def create_project():
    if get_deployment_mode() == "render":
        return api_error("No worker is enrolled with this Render control plane. Deployments are unavailable.", 503)

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error("Send a JSON object describing the deployment.", 400)
    name = data.get("name", "")
    ptype = data.get("type", "")
    if not isinstance(name, str) or not PROJECT_NAME.fullmatch(name.strip()):
        return api_error("Project name must be 1–48 characters and use letters, numbers, dots, underscores, or hyphens.", 400)
    if not isinstance(ptype, str) or not get_template(ptype):
        return api_error("Choose a supported deployment template.", 400)

    raw_ram = data.get("ram_mb", 512)
    raw_storage = data.get("storage_mb", 1024)
    raw_cpu = data.get("cpu_limit", 0)
    if type(raw_ram) is not int or type(raw_storage) is not int or isinstance(raw_cpu, bool):
        return api_error("RAM and storage allocations must be whole numbers.", 400)
    try:
        ram_mb = raw_ram
        storage_mb = raw_storage
        requested_cpu = float(data.get("cpu_limit", 0))
    except (TypeError, ValueError, OverflowError):
        return api_error("RAM and storage must be whole numbers and CPU must be a number.", 400)
    if not math.isfinite(requested_cpu) or requested_cpu < 0:
        return api_error("CPU allocation is invalid.", 400)
    if ram_mb < 64 or storage_mb < 1:
        return api_error("RAM must be at least 64 MB and storage must be positive.", 400)

    tpl = get_template(ptype)
    image = data.get("image") or tpl["image"]
    command = data.get("command") or tpl.get("command")
    if not isinstance(image, str) or not image.strip() or len(image) > 256:
        return api_error("Container image is invalid.", 400)
    if command is not None and (not isinstance(command, str) or len(command) > 2048):
        return api_error("Container command is invalid.", 400)

    user_id = current_user_id()
    conn = get_db()
    volume_path = None
    reserved = False
    container_id = None
    try:
        conn.execute("BEGIN IMMEDIATE")
        account = conn.execute("SELECT plan_id FROM users WHERE id = ?", (user_id,)).fetchone()
        plan = get_plan(account["plan_id"] if account else 1, conn)
        if not plan:
            return api_error("No plan is configured for this account.", 503)
        usage = get_user_usage(user_id, conn)
        if usage["deployments"] >= plan["max_deployments"]:
            return api_error(f"Plan limit: max {plan['max_deployments']} running deployments.", 400)
        if ram_mb > plan["ram_mb"]:
            return api_error(f"Plan limit: max {plan['ram_mb']} MB RAM.", 400)
        if storage_mb > plan["storage_mb"]:
            return api_error(f"Plan limit: max {plan['storage_mb']} MB storage.", 400)
        if requested_cpu and requested_cpu > plan["cpu_limit"]:
            return api_error(f"Plan limit: max {plan['cpu_limit']} CPU cores.", 400)
        cpu_allocation = requested_cpu or float(plan["cpu_limit"])

        worker_row = conn.execute("SELECT * FROM workers WHERE id = 1").fetchone()
        worker = dict_from_row(worker_row)
        if not worker or worker["status"] != "healthy":
            return api_error("No healthy local worker is available.", 503)
        if ram_mb > worker["total_ram_mb"] - worker["reserved_ram_mb"]:
            return api_error("Not enough unreserved RAM on the local worker.", 409)
        if cpu_allocation > worker["total_cpu"] - worker["reserved_cpu"]:
            return api_error("Not enough unreserved CPU capacity on the local worker.", 409)
        if storage_mb > worker["total_storage_mb"] - worker["reserved_storage_mb"]:
            return api_error("Not enough unreserved storage on the local worker.", 409)
        if storage_mb * 1024 * 1024 > shutil.disk_usage(DATA_DIR).free:
            return api_error("Not enough free disk space on the local worker.", 409)

        conn.execute(
            "UPDATE workers SET reserved_ram_mb = reserved_ram_mb + ?, reserved_cpu = reserved_cpu + ?, "
            "reserved_storage_mb = reserved_storage_mb + ? WHERE id = 1",
            (ram_mb, cpu_allocation, storage_mb),
        )
        conn.commit()
        reserved = True

        volume_path = str(VOLUMES_DIR / uuid.uuid4().hex)
        Path(volume_path).mkdir(parents=True, exist_ok=False)
        for relative_name, contents in tpl.get("starter_files", {}).items():
            (Path(volume_path) / relative_name).write_text(contents, encoding="utf-8")
        result = docker_worker.run_container(
            image=image.strip(),
            name=f"hosting-{uuid.uuid4().hex[:20]}",
            ram_mb=ram_mb,
            cpu_limit=cpu_allocation,
            volume_path=volume_path,
            volume_target=tpl.get("volume_target", "/data"),
            port=tpl.get("port"),
            command=command,
            env=tpl.get("env", {}),
        )
        if "error" in result:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), "
                "reserved_cpu = MAX(0, reserved_cpu - ?), "
                "reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
                (ram_mb, cpu_allocation, storage_mb),
            )
            conn.commit()
            reserved = False
            shutil.rmtree(volume_path, ignore_errors=True)
            return api_error(result["error"], 502)

        container_id = result.get("id")
        now = datetime.now(timezone.utc).isoformat()
        cursor = conn.execute(
            """INSERT INTO projects
               (user_id, name, type, status, ram_mb, storage_mb, cpu_limit, container_id, volume_path, host_port, created_at)
               VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, name.strip(), ptype, ram_mb, storage_mb, cpu_allocation, result.get("id"), volume_path, result.get("host_port"), now),
        )
        conn.commit()
        return jsonify({
            "id": cursor.lastrowid,
            "status": "running",
            "container": result,
            "template": tpl["name"],
        }), 201
    except Exception:
        if conn.in_transaction:
            conn.rollback()
        if container_id:
            cleanup = docker_worker.remove_container(container_id)
            if "error" in cleanup:
                current_app.logger.error("Failed to remove orphaned container %s: %s", container_id, cleanup["error"])
        if reserved:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute(
                "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), "
                "reserved_cpu = MAX(0, reserved_cpu - ?), "
                "reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
                (ram_mb, cpu_allocation, storage_mb),
            )
            conn.commit()
        if volume_path:
            shutil.rmtree(volume_path, ignore_errors=True)
        raise
    finally:
        conn.close()


def get_project(conn, project_id):
    return dict_from_row(conn.execute(
        "SELECT * FROM projects WHERE id = ? AND user_id = ?",
        (project_id, current_user_id()),
    ).fetchone())


def project_file_path(project, requested_path):
    if not isinstance(requested_path, str) or "\x00" in requested_path or "\\" in requested_path:
        raise ValueError("File path is invalid.")
    relative = Path(requested_path)
    if relative.is_absolute() or any(part in {".", ".."} for part in relative.parts):
        raise ValueError("File path must stay within the project directory.")
    root = Path(project["volume_path"]).resolve(strict=True)
    managed_root = VOLUMES_DIR.resolve(strict=True)
    if root == managed_root or not root.is_relative_to(managed_root):
        raise ValueError("Project storage is outside the managed volume directory.")
    candidate = root.joinpath(relative)
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError("Project symlinks cannot be accessed from the file manager.")
    resolved = candidate.resolve(strict=False)
    if not resolved.is_relative_to(root):
        raise ValueError("File path must stay within the project directory.")
    return root, candidate


def project_storage_usage(root):
    total = 0
    for directory, subdirectories, filenames in os.walk(root, followlinks=False):
        subdirectories[:] = [
            name for name in subdirectories
            if not (Path(directory) / name).is_symlink()
        ]
        for filename in filenames:
            file_path = Path(directory) / filename
            if not file_path.is_symlink() and file_path.is_file():
                total += file_path.stat().st_size
    return total


def project_for_file_operation(conn, project_id):
    project = get_project(conn, project_id)
    if not project:
        return None, (api_error("Project not found.", 404))
    if not project.get("volume_path"):
        return None, api_error("This project has no managed storage volume.", 404)
    try:
        root, _ = project_file_path(project, "")
    except (OSError, ValueError):
        current_app.logger.exception("Project storage volume is unavailable or invalid.")
        return None, api_error("Project storage is unavailable.", 404)
    if not root.is_dir():
        return None, api_error("Project storage is unavailable.", 404)
    return project, None


@api.route("/projects/<int:pid>/files")
def list_project_files(pid):
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        _, directory = project_file_path(project, request.args.get("path", ""))
        if not directory.is_dir():
            return api_error("The requested path is not a directory.", 400)
        entries = []
        for path in sorted(directory.iterdir(), key=lambda item: (not item.is_dir(), item.name.casefold())):
            if path.is_symlink():
                continue
            stat = path.stat()
            entries.append({
                "name": path.name,
                "path": path.relative_to(project["volume_path"]).as_posix(),
                "type": "directory" if path.is_dir() else "file",
                "size": stat.st_size if path.is_file() else None,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            })
        return jsonify({"path": request.args.get("path", ""), "entries": entries})
    except (OSError, ValueError) as error:
        return api_error(str(error) or "Could not list project files.", 400)


@api.route("/projects/<int:pid>/files/content")
def read_project_file(pid):
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        _, path = project_file_path(project, request.args.get("path", ""))
        if not path.is_file():
            return api_error("The requested file does not exist.", 404)
        if path.stat().st_size > 1_000_000:
            return api_error("File is too large to edit in the browser (1 MB maximum).", 413)
        content = path.read_bytes()
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            return api_error("This file is binary and cannot be edited in the browser.", 415)
        return jsonify({"path": request.args.get("path", ""), "content": text})
    except (OSError, ValueError) as error:
        return api_error(str(error) or "Could not read project file.", 400)


@api.route("/projects/<int:pid>/files/download")
def download_project_file(pid):
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        _, path = project_file_path(project, request.args.get("path", ""))
        if not path.is_file():
            return api_error("The requested file does not exist.", 404)
        return send_file(path, as_attachment=True, download_name=path.name)
    except (OSError, ValueError) as error:
        return api_error(str(error) or "Could not download project file.", 400)


@api.route("/projects/<int:pid>/files/content", methods=["PUT"])
def write_project_file(pid):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error("Send a JSON object containing path and content.", 400)
    relative_path = data.get("path")
    content = data.get("content")
    if not isinstance(content, str) or len(content.encode("utf-8")) > 1_000_000:
        return api_error("File content must be text no larger than 1 MB.", 413)
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        root, path = project_file_path(project, relative_path)
        if path == root or not path.parent.is_dir():
            return api_error("Choose a file inside an existing project folder.", 400)
        if path.exists() and not path.is_file():
            return api_error("The selected path is not a file.", 400)
        old_size = path.stat().st_size if path.is_file() else 0
        requested_size = len(content.encode("utf-8"))
        if project_storage_usage(root) - old_size + requested_size > project["storage_mb"] * 1024 * 1024:
            return api_error("The project storage allocation would be exceeded.", 413)
        temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
        try:
            temporary.write_text(content, encoding="utf-8")
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
        return jsonify({"path": relative_path, "size": path.stat().st_size})
    except (OSError, TypeError, ValueError) as error:
        return api_error(str(error) or "Could not write project file.", 400)


@api.route("/projects/<int:pid>/files/upload", methods=["POST"])
def upload_project_file(pid):
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return api_error("Choose a file to upload.", 400)
    filename = secure_filename(uploaded.filename)
    if not filename:
        return api_error("The filename is invalid.", 400)
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        _, parent = project_file_path(project, request.form.get("path", ""))
        if not parent.is_dir():
            return api_error("The selected destination folder does not exist.", 404)
        destination = parent / filename
        if destination.exists():
            return api_error("A file or folder with that name already exists.", 409)
        root, _ = project_file_path(project, "")
        used_storage = project_storage_usage(root)
        temporary = parent / f".{uuid.uuid4().hex}.upload"
        try:
            uploaded.save(temporary)
            if used_storage + temporary.stat().st_size > project["storage_mb"] * 1024 * 1024:
                return api_error("The project storage allocation would be exceeded.", 413)
            try:
                os.link(temporary, destination)
            except FileExistsError:
                return api_error("A file or folder with that name already exists.", 409)
        finally:
            temporary.unlink(missing_ok=True)
        return jsonify({"name": filename, "size": destination.stat().st_size}), 201
    except (OSError, ValueError) as error:
        return api_error(str(error) or "Could not upload project file.", 400)


@api.route("/projects/<int:pid>/files/folders", methods=["POST"])
def create_project_folder(pid):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return api_error("Send a JSON object containing path and name.", 400)
    name = data.get("name")
    if not isinstance(name, str) or name in {"", ".", ".."} or "/" in name or "\\" in name or "\x00" in name:
        return api_error("Folder name must be a single valid path component.", 400)
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        _, parent = project_file_path(project, data.get("path", ""))
        if not parent.is_dir():
            return api_error("The selected parent folder does not exist.", 404)
        folder = parent / name
        folder.mkdir()
        return jsonify({"name": name}), 201
    except FileExistsError:
        return api_error("A file or folder with that name already exists.", 409)
    except (OSError, TypeError, ValueError) as error:
        return api_error(str(error) or "Could not create project folder.", 400)


@api.route("/projects/<int:pid>/files", methods=["DELETE"])
def delete_project_file(pid):
    relative_path = request.args.get("path", "")
    conn = get_db()
    try:
        project, error = project_for_file_operation(conn, pid)
    finally:
        conn.close()
    if error:
        return error
    try:
        root, path = project_file_path(project, relative_path)
        if path == root:
            return api_error("The project root cannot be deleted.", 400)
        if path.is_dir():
            shutil.rmtree(path)
        elif path.is_file():
            path.unlink()
        else:
            return api_error("The requested file or folder does not exist.", 404)
        return jsonify({"status": "deleted"})
    except (OSError, ValueError) as error:
        return api_error(str(error) or "Could not delete project file.", 400)


@api.route("/projects/<int:pid>/stop", methods=["POST"])
def stop_project(pid):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = get_project(conn, pid)
        if not project:
            return api_error("Project not found.", 404)
        if project["status"] != "running":
            return jsonify({"status": project["status"]})
        result = docker_worker.stop_container(project["container_id"])
        if "error" in result:
            return api_error(result["error"], 502)
        conn.execute("UPDATE projects SET status = 'stopped' WHERE id = ?", (pid,))
        conn.execute(
            "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), "
            "reserved_cpu = MAX(0, reserved_cpu - ?), "
            "reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
            (project["ram_mb"], project["cpu_limit"], project["storage_mb"]),
        )
        conn.commit()
        return jsonify({"status": "stopped"})
    finally:
        conn.close()


@api.route("/projects/<int:pid>/start", methods=["POST"])
def start_project(pid):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = get_project(conn, pid)
        if not project:
            return api_error("Project not found.", 404)
        if project["status"] == "running":
            return jsonify({"status": "running"})
        worker = dict_from_row(conn.execute("SELECT * FROM workers WHERE id = 1").fetchone())
        if not worker or worker["status"] != "healthy":
            return api_error("No healthy local worker is available.", 503)
        if project["ram_mb"] > worker["total_ram_mb"] - worker["reserved_ram_mb"]:
            return api_error("Not enough unreserved RAM on the local worker.", 409)
        if project["cpu_limit"] > worker["total_cpu"] - worker["reserved_cpu"]:
            return api_error("Not enough unreserved CPU capacity on the local worker.", 409)
        if project["storage_mb"] > worker["total_storage_mb"] - worker["reserved_storage_mb"]:
            return api_error("Not enough unreserved storage on the local worker.", 409)
        client = docker_worker.get_client()
        if not client:
            return api_error("Docker is unavailable; the project was not started.", 503)
        try:
            container = client.containers.get(project["container_id"])
            container.start()
        except Exception as error:
            return api_error(f"Container could not be started: {error}", 502)
        conn.execute(
            "UPDATE workers SET reserved_ram_mb = reserved_ram_mb + ?, reserved_cpu = reserved_cpu + ?, "
            "reserved_storage_mb = reserved_storage_mb + ? WHERE id = 1",
            (project["ram_mb"], project["cpu_limit"], project["storage_mb"]),
        )
        conn.execute("UPDATE projects SET status = 'running' WHERE id = ?", (pid,))
        conn.commit()
        return jsonify({"status": "running"})
    finally:
        conn.close()


@api.route("/projects/<int:pid>/restart", methods=["POST"])
def restart_project(pid):
    conn = get_db()
    try:
        project = get_project(conn, pid)
    finally:
        conn.close()
    if not project:
        return api_error("Project not found.", 404)
    if project["status"] != "running":
        return api_error("Start the project before restarting it.", 409)
    if not project.get("container_id"):
        return api_error("No container is associated with this project.", 409)
    result = docker_worker.restart_container(project["container_id"])
    if "error" in result:
        return api_error(result["error"], 502)
    return jsonify({"status": "running"})


@api.route("/projects/<int:pid>/logs")
def project_logs(pid):
    conn = get_db()
    try:
        project = get_project(conn, pid)
    finally:
        conn.close()
    if not project:
        return api_error("Project not found.", 404)
    if not project.get("container_id"):
        return jsonify({"logs": "No container is associated with this project."})
    client = docker_worker.get_client()
    if not client:
        return api_error("Docker is unavailable.", 503)
    try:
        container = client.containers.get(project["container_id"])
        logs = container.logs(tail=200).decode("utf-8", errors="replace")
        return jsonify({"logs": logs})
    except Exception:
        return api_error("Could not retrieve container logs.", 502)


@api.route("/projects/<int:pid>", methods=["DELETE"])
def delete_project(pid):
    conn = get_db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        project = get_project(conn, pid)
        if not project:
            return api_error("Project not found.", 404)
        if project.get("container_id"):
            result = docker_worker.remove_container(project["container_id"])
            if "error" in result:
                return api_error(result["error"], 502)
        volume = Path(project["volume_path"]).resolve() if project.get("volume_path") else None
        volumes_root = VOLUMES_DIR.resolve()
        if volume and not volume.is_relative_to(volumes_root):
            return api_error("Project volume path is outside the managed storage root.", 500)
        if volume and volume.exists():
            shutil.rmtree(volume)
        conn.execute("DELETE FROM projects WHERE id = ?", (pid,))
        if project["status"] == "running":
            conn.execute(
                "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), "
                "reserved_cpu = MAX(0, reserved_cpu - ?), "
                "reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
                (project["ram_mb"], project["cpu_limit"], project["storage_mb"]),
            )
        conn.commit()
        return jsonify({"status": "deleted"})
    finally:
        conn.close()


@api.route("/docker/containers")
def docker_containers():
    if get_deployment_mode() == "render":
        return api_error("No worker is enrolled with this Render control plane.", 503)
    containers = docker_worker.list_containers()
    if isinstance(containers, dict) and "error" in containers:
        return api_error(containers["error"], 503)
    return jsonify(containers)


@api.route("/monitoring/metrics")
def monitoring_metrics():
    if get_deployment_mode() == "render":
        return api_error("No worker is enrolled with this Render control plane.", 503)
    client = docker_worker.get_client()
    if not client:
        return api_error("Docker daemon is unavailable; live metrics cannot be sampled.", 503)
    user_id = current_user_id()
    conn = get_db()
    try:
        projects = conn.execute(
            "SELECT id, name, type, container_id, volume_path, storage_mb FROM projects "
            "WHERE user_id = ? AND status = 'running' ORDER BY id",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()
    metrics = []
    for row in projects:
        project = dict(row)
        measured = docker_worker.container_metrics(project["container_id"], client)
        if "error" in measured:
            metrics.append({
                "project_id": project["id"],
                "name": project["name"],
                "error": measured["error"],
            })
            continue
        try:
            volume_root, _ = project_file_path(project, "")
            storage_used = project_storage_usage(volume_root)
        except (OSError, ValueError):
            storage_used = None
        metrics.append({
            "project_id": project["id"],
            "name": project["name"],
            "type": project["type"],
            "storage_used_bytes": storage_used,
            "storage_limit_bytes": project["storage_mb"] * 1024 * 1024,
            **measured,
        })
    return jsonify({
        "sampled_at": datetime.now(timezone.utc).isoformat(),
        "sampling": "instantaneous",
        "metrics": metrics,
    })


@api.route("/upload", methods=["POST"])
def upload_file():
    if get_deployment_mode() == "render":
        return api_error("Uploads are unavailable until persistent worker storage is configured.", 503)
    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return api_error("Choose a file to upload.", 400)
    filename = secure_filename(uploaded_file.filename)
    if not filename:
        return api_error("The filename is invalid.", 400)
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    path = UPLOADS_DIR / unique_name
    uploaded_file.save(path)
    return jsonify({"filename": unique_name}), 201


@api.route("/admin/stats")
def admin_stats():
    conn = get_db()
    try:
        total_projects = conn.execute("SELECT COUNT(*) AS c FROM projects").fetchone()["c"]
        running = conn.execute("SELECT COUNT(*) AS c FROM projects WHERE status = 'running'").fetchone()["c"]
        worker = dict_from_row(conn.execute("SELECT * FROM workers WHERE id = 1").fetchone())
    finally:
        conn.close()
    return jsonify({
        "total_projects": total_projects,
        "running": running,
        "worker": worker if get_deployment_mode() != "render" else None,
        "docker": docker_worker.get_docker_info() if get_deployment_mode() != "render" else {"available": False},
    })


@api.route("/admin/users")
def admin_users():
    conn = get_db()
    try:
        users = conn.execute(
            """SELECT users.id, users.email, users.name, users.status, users.created_at,
                      plans.name AS plan,
                      COUNT(projects.id) AS project_count
               FROM users
               LEFT JOIN plans ON plans.id = users.plan_id
               LEFT JOIN projects ON projects.user_id = users.id
               WHERE users.id != 1
               GROUP BY users.id
               ORDER BY users.created_at DESC, users.id DESC"""
        ).fetchall()
        active_count = sum(1 for user in users if user["status"] == "active")
        return jsonify({
            "users": [dict(user) for user in users],
            "total_users": len(users),
            "active_users": active_count,
        })
    finally:
        conn.close()
