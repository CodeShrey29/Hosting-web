from flask import Blueprint, request, jsonify, session
from .db import get_db, dict_from_row, init_db, get_plan, get_user_usage, VOLUMES_DIR, UPLOADS_DIR
from . import docker_worker
from .templates import get_template, list_templates
from datetime import datetime
import os
import zipfile
import shutil

api = Blueprint("api", __name__, url_prefix="/api")

LOCAL_SECRET = os.environ.get("HOSTING_SECRET", "local-pc-secret")

@api.before_app_request
def ensure_db():
    init_db()

@api.route("/health")
def health():
    return jsonify({"status": "ok", "mode": "local-pc"})

@api.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "local@pc")
    secret = data.get("secret", "")
    if secret and secret != LOCAL_SECRET:
        return jsonify({"error": "Invalid secret"}), 401
    session["user_id"] = 1
    session["email"] = email
    return jsonify({"ok": True, "user": {"id": 1, "email": email}})

@api.route("/auth/me")
def me():
    if not session.get("user_id"):
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "email": session.get("email")})

@api.route("/status")
def status():
    docker_info = docker_worker.get_docker_info()
    conn = get_db()
    worker = dict_from_row(conn.execute("SELECT * FROM workers WHERE id = 1").fetchone())
    projects = conn.execute("SELECT COUNT(*) as c FROM projects").fetchone()["c"]
    plan = get_plan(1)
    usage = get_user_usage(1)
    conn.close()
    return jsonify({
        "worker": worker,
        "docker": docker_info,
        "projects": projects,
        "plan": plan,
        "usage": usage,
        "mode": "Local PC"
    })

@api.route("/templates")
def templates():
    return jsonify(list_templates())

@api.route("/plans")
def list_plans():
    conn = get_db()
    rows = conn.execute("SELECT * FROM plans").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@api.route("/projects", methods=["GET"])
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@api.route("/projects", methods=["POST"])
def create_project():
    data = request.get_json() or {}
    name = data.get("name", "untitled").replace(" ", "-").lower()
    ptype = data.get("type", "python")
    ram_mb = int(data.get("ram_mb", 512))
    storage_mb = int(data.get("storage_mb", 1024))
    zip_filename = data.get("zip_filename")

    tpl = get_template(ptype)
    image = data.get("image") or tpl["image"]
    command = data.get("command") or tpl.get("command")
    env = tpl.get("env", {})

    plan = get_plan(1)
    usage = get_user_usage(1)

    if usage["deployments"] >= plan["max_deployments"]:
        return jsonify({"error": f"Plan limit: max {plan['max_deployments']} deployments"}), 400
    if ram_mb > plan["ram_mb"]:
        return jsonify({"error": f"Plan limit: max {plan['ram_mb']} MB RAM"}), 400

    conn = get_db()
    worker = conn.execute("SELECT * FROM workers WHERE id = 1").fetchone()
    if ram_mb > (worker["total_ram_mb"] - worker["reserved_ram_mb"]):
        conn.close()
        return jsonify({"error": "Not enough capacity on local worker"}), 400

    volume_path = str(VOLUMES_DIR / f"{name}-{int(datetime.utcnow().timestamp())}")
    os.makedirs(volume_path, exist_ok=True)

    if zip_filename:
        zip_path = UPLOADS_DIR / zip_filename
        if zip_path.exists():
            try:
                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(volume_path)
            except Exception as e:
                conn.close()
                return jsonify({"error": f"ZIP failed: {e}"}), 400

    result = docker_worker.run_container(
        image=image,
        name=f"hosting-{name}-{int(datetime.utcnow().timestamp())}",
        ram_mb=ram_mb,
        volume_path=volume_path,
        command=command,
        env=env,
    )

    if "error" in result:
        conn.close()
        return jsonify(result), 400

    c = conn.cursor()
    c.execute(
        """INSERT INTO projects (user_id, name, type, status, ram_mb, storage_mb, container_id, volume_path, created_at)
           VALUES (1, ?, ?, 'running', ?, ?, ?, ?, ?)""",
        (name, ptype, ram_mb, storage_mb, result.get("id"), volume_path, datetime.utcnow().isoformat()),
    )
    c.execute(
        "UPDATE workers SET reserved_ram_mb = reserved_ram_mb + ?, reserved_storage_mb = reserved_storage_mb + ? WHERE id = 1",
        (ram_mb, storage_mb),
    )
    conn.commit()
    pid = c.lastrowid
    conn.close()

    return jsonify({"id": pid, "status": "running", "container": result, "template": tpl["name"]})

@api.route("/projects/<int:pid>/stop", methods=["POST"])
def stop_project(pid):
    conn = get_db()
    proj = dict_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    if not proj:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    if proj.get("container_id"):
        docker_worker.stop_container(proj["container_id"])
    conn.execute("UPDATE projects SET status = 'stopped' WHERE id = ?", (pid,))
    conn.execute(
        "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
        (proj["ram_mb"], proj["storage_mb"]),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "stopped"})

@api.route("/projects/<int:pid>/start", methods=["POST"])
def start_project(pid):
    conn = get_db()
    proj = dict_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    if not proj:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    client = docker_worker.get_client()
    if client and proj.get("container_id"):
        try:
            c = client.containers.get(proj["container_id"])
            c.start()
        except Exception as e:
            conn.close()
            return jsonify({"error": str(e)}), 400
    conn.execute("UPDATE projects SET status = 'running' WHERE id = ?", (pid,))
    conn.execute(
        "UPDATE workers SET reserved_ram_mb = reserved_ram_mb + ?, reserved_storage_mb = reserved_storage_mb + ? WHERE id = 1",
        (proj["ram_mb"], proj["storage_mb"]),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "running"})

@api.route("/projects/<int:pid>/logs")
def project_logs(pid):
    conn = get_db()
    proj = dict_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    conn.close()
    if not proj or not proj.get("container_id"):
        return jsonify({"logs": "No container"})
    client = docker_worker.get_client()
    if not client:
        return jsonify({"logs": "Docker unavailable"})
    try:
        c = client.containers.get(proj["container_id"])
        logs = c.logs(tail=150).decode("utf-8", errors="replace")
        return jsonify({"logs": logs or "(empty)"})
    except Exception as e:
        return jsonify({"logs": str(e)})

@api.route("/projects/<int:pid>", methods=["DELETE"])
def delete_project(pid):
    conn = get_db()
    proj = dict_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    if not proj:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    if proj.get("container_id"):
        docker_worker.remove_container(proj["container_id"])
    if proj.get("volume_path") and os.path.exists(proj["volume_path"]):
        shutil.rmtree(proj["volume_path"], ignore_errors=True)
    conn.execute("DELETE FROM projects WHERE id = ?", (pid,))
    if proj["status"] == "running":
        conn.execute(
            "UPDATE workers SET reserved_ram_mb = MAX(0, reserved_ram_mb - ?), reserved_storage_mb = MAX(0, reserved_storage_mb - ?) WHERE id = 1",
            (proj["ram_mb"], proj["storage_mb"]),
        )
    conn.commit()
    conn.close()
    return jsonify({"status": "deleted"})

@api.route("/docker/containers")
def docker_containers():
    return jsonify(docker_worker.list_containers())

@api.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "Empty"}), 400
    safe = f"{int(datetime.utcnow().timestamp())}_{f.filename}"
    path = UPLOADS_DIR / safe
    f.save(path)
    return jsonify({"filename": safe})

@api.route("/admin/stats")
def admin_stats():
    conn = get_db()
    total_projects = conn.execute("SELECT COUNT(*) as c FROM projects").fetchone()["c"]
    running = conn.execute("SELECT COUNT(*) as c FROM projects WHERE status='running'").fetchone()["c"]
    worker = dict_from_row(conn.execute("SELECT * FROM workers WHERE id=1").fetchone())
    conn.close()
    return jsonify({
        "total_projects": total_projects,
        "running": running,
        "worker": worker,
        "docker": docker_worker.get_docker_info()
    })
