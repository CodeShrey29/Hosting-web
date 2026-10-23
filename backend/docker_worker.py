"""Local Docker worker. Runs containers on the same PC."""
import docker
from docker.errors import DockerException

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

def run_container(image: str, name: str, ram_mb: int = 512, env: dict = None):
    client = get_client()
    if not client:
        return {"error": "Docker not available on this machine"}

    mem_limit = f"{ram_mb}m"
    try:
        container = client.containers.run(
            image,
            name=name,
            detach=True,
            mem_limit=mem_limit,
            environment=env or {},
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
            "memory": info.get("MemTotal"),
        }
    except Exception as e:
        return {"available": False, "message": str(e)}
