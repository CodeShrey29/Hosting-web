"""Local Docker worker with volume support."""
import docker
from docker.errors import DockerException
from pathlib import Path

def get_client():
    try:
        return docker.from_env()
    except DockerException as e:
        print(f"Docker not available: {e}")
        return None

def list_containers():
    client = get_client()
    if not client:
        return []
    try:
        return [
            {
                "id": c.id[:12],
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "unknown",
            }
            for c in client.containers.list(all=True)
        ]
    except Exception:
        return []

def run_container(
    image: str,
    name: str,
    ram_mb: int = 512,
    volume_path: str = None,
    env: dict = None,
    command: str = None,
):
    client = get_client()
    if not client:
        return {"error": "Docker not available on this machine"}

    mem_limit = f"{ram_mb}m"
    volumes = {}
    if volume_path:
        Path(volume_path).mkdir(parents=True, exist_ok=True)
        volumes[volume_path] = {"bind": "/data", "mode": "rw"}

    try:
        container = client.containers.run(
            image,
            name=name,
            detach=True,
            mem_limit=mem_limit,
            environment=env or {},
            volumes=volumes,
            command=command,
            restart_policy={"Name": "unless-stopped"},
            labels={"hosting.managed": "true"},
        )
        return {
            "id": container.id[:12],
            "name": container.name,
            "status": container.status,
        }
    except Exception as e:
        return {"error": str(e)}

def stop_container(name_or_id: str):
    client = get_client()
    if not client:
        return {"error": "Docker not available"}
    try:
        c = client.containers.get(name_or_id)
        c.stop()
        return {"status": "stopped"}
    except Exception as e:
        return {"error": str(e)}

def remove_container(name_or_id: str):
    client = get_client()
    if not client:
        return {"error": "Docker not available"}
    try:
        c = client.containers.get(name_or_id)
        c.remove(force=True)
        return {"status": "removed"}
    except Exception as e:
        return {"error": str(e)}

def get_docker_info():
    client = get_client()
    if not client:
        return {"available": False, "message": "Docker not running or not installed"}
    try:
        info = client.info()
        return {
            "available": True,
            "version": info.get("ServerVersion"),
            "containers": info.get("Containers"),
            "running": info.get("ContainersRunning"),
            "memory_total": info.get("MemTotal"),
        }
    except Exception as e:
        return {"available": False, "message": str(e)}

def get_container_stats(container_id: str):
    client = get_client()
    if not client:
        return None
    try:
        c = client.containers.get(container_id)
        stats = c.stats(stream=False)
        mem = stats.get("memory_stats", {})
        return {
            "memory_usage": mem.get("usage", 0),
            "memory_limit": mem.get("limit", 0),
        }
    except Exception:
        return None
