from flask import Blueprint, request, jsonify
from .db import get_db, dict_from_row, init_db
from . import docker_worker
from datetime import datetime

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
    conn.close()
    return jsonify({
        "worker": worker,
        "docker": docker_info,
        "projects": projects,
        "mode": "Local PC"
    })

@api.route("/projects", methods=["GET"])
def list_projects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@api.route("/projects", methods=["POST"])
def create_project():
    data = request.get_json() or {}
    name = data.get("name", "untitled")
    ptype = data.get("type", "custom")
    ram_mb = int(data.get("ram_mb", 512))
    image = data.get("image", "python:3.11-slim")

    conn = get_db()
    # Simple reservation check
    worker = conn.execute("SELECT * FROM workers WHERE id = 1").fetchone()
    available = worker["total_ram_mb"] - worker["reserved_ram_mb"]
    if ram_mb > available:
        conn.close()
        return jsonify({"error": "Not enough reserved capacity on local worker"}), 400

    result = docker_worker.run_container(
        image=image,
        name=f"hosting-{name}-{int(datetime.utcnow().timestamp())}",
        ram_mb=ram_mb,
    )

    if "error" in result:
        conn.close()
        return jsonify(result), 400

    c = conn.cursor()
    c.execute(
        """INSERT INTO projects (user_id, name, type, status, ram_mb, storage_mb, container_id, created_at)
           VALUES (1, ?, ?, 'running', ?, 1024, ?, ?)""",
        (name, ptype, ram_mb, result.get("id"), datetime.utcnow().isoformat()),
    )
    c.execute(
        "UPDATE workers SET reserved_ram_mb = reserved_ram_mb + ? WHERE id = 1",
        (ram_mb,),
    )
    conn.commit()
    project_id = c.lastrowid
    conn.close()

    return jsonify({"id": project_id, "container": result, "status": "running"})

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
        "UPDATE workers SET reserved_ram_mb = reserved_ram_mb - ? WHERE id = 1",
        (proj["ram_mb"],),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "stopped"})

@api.route("/docker/containers")
def docker_containers():
    return jsonify(docker_worker.list_containers())
