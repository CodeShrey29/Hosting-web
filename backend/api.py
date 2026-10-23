from flask import Blueprint, request, jsonify
from .db import get_db, dict_from_row, init_db, get_plan, get_user_usage, VOLUMES_DIR, UPLOADS_DIR
from . import docker_worker
from datetime import datetime
import os

api = Blueprint("api", __name__, url_prefix="/api")

@api.before_app_request
def ensure_db():
    init_db()

@api.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "mode": "local-pc",
        "message": "Control plane running on this machine"
    })

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
    ptype = data.get("type", "custom")
    ram_mb = int(data.get("ram_mb", 512))
    storage_mb = int(data.get("storage_mb", 1024))
    image = data.get("image", "python:3.11-slim")

    plan = get_plan(1)
    usage = get_user_usage(1)

    if usage["deployments"] >= plan["max_deployments"]:
        return jsonify({"error": f"Plan limit reached ({plan['max_deployments']} deployments)"}), 400
    if ram_mb > plan["ram_mb"]:
        return jsonify({"error": f"RAM exceeds plan limit ({plan['ram_mb']} MB)"}), 400
    if storage_mb > plan["storage_mb"]:
        return jsonify({"error": f"Storage exceeds plan limit ({plan['storage_mb']} MB)"}), 400

    conn = get_db()
    worker = conn.execute("SELECT * FROM workers WHERE id = 1").fetchone()
    available_ram = worker["total_ram_mb"] - worker["reserved_ram_mb"]
    if ram_mb > available_ram:
        conn.close()
        return jsonify({"error": "Not enough capacity on local worker"}), 400

    volume_path = str(VOLUMES_DIR / f"{name}-{int(datetime.utcnow().timestamp())}")
    os.makedirs(volume_path, exist_ok=True)

    result = docker_worker.run_container(
        image=image,
        name=f"hosting-{name}-{int(datetime.utcnow().timestamp())}",
        ram_mb=ram_mb,
        volume_path=volume_path,
        command=data.get("command"),
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
    project_id = c.lastrowid
    conn.close()

    return jsonify({"id": project_id, "container": result, "status": "running", "volume": volume_path})

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

@api.route("/projects/<int:pid>", methods=["DELETE"])
def delete_project(pid):
    conn = get_db()
    proj = dict_from_row(conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    if not proj:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    if proj.get("container_id"):
        docker_worker.remove_container(proj["container_id"])

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
        return jsonify({"error": "Empty filename"}), 400
    safe_name = f"{int(datetime.utcnow().timestamp())}_{f.filename}"
    path = UPLOADS_DIR / safe_name
    f.save(path)
    return jsonify({"path": str(path), "filename": safe_name})
