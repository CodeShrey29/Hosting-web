"""Local Docker worker with volume + env support."""
import logging
import docker
from docker.errors import DockerException
from pathlib import Path

logger = logging.getLogger(__name__)

def get_client():
    try:
        return docker.from_env()
    except DockerException as e:
        logger.warning("Docker is unavailable: %s", e)
        return None

def list_containers():
    client = get_client()
    if not client:
        return {"error": "Docker is unavailable"}
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
    except DockerException as error:
        return {"error": f"Could not list Docker containers: {error}"}

def run_container(
    image: str,
    name: str,
    ram_mb: int = 512,
    cpu_limit: float = 0.5,
    volume_path: str = None,
    env: dict = None,
    command: str = None,
):
    client = get_client()
    if not client:
        return {"error": "Docker not available"}

    volumes = {}
    if volume_path:
        Path(volume_path).mkdir(parents=True, exist_ok=True)
        volumes[str(volume_path)] = {"bind": "/data", "mode": "rw"}

    try:
        kwargs = {
            "detach": True,
            "name": name,
            "mem_limit": f"{ram_mb}m",
            "memswap_limit": f"{ram_mb}m",
            "nano_cpus": int(cpu_limit * 1_000_000_000),
            "pids_limit": 256,
            "cap_drop": ["ALL"],
            "security_opt": ["no-new-privileges:true"],
            "tmpfs": {"/tmp": "rw,noexec,nosuid,size=64m"},
            "environment": env or {},
            "volumes": volumes,
            "restart_policy": {"Name": "unless-stopped"},
            "labels": {"hosting.managed": "true"},
        }
        if command:
            kwargs["command"] = command
        container = client.containers.run(image, **kwargs)
        return {"id": container.id[:12], "name": container.name, "status": container.status}
    except DockerException as e:
        return {"error": str(e)}

def stop_container(name_or_id: str):
    client = get_client()
    if not client:
        return {"error": "Docker unavailable"}
    try:
        c = client.containers.get(name_or_id)
        c.stop()
        return {"status": "stopped"}
    except DockerException as e:
        return {"error": str(e)}

def remove_container(name_or_id: str):
    client = get_client()
    if not client:
        return {"error": "Docker unavailable"}
    try:
        c = client.containers.get(name_or_id)
        c.remove(force=True)
        return {"status": "removed"}
    except DockerException as e:
        return {"error": str(e)}

def get_docker_info():
    client = get_client()
    if not client:
        return {"available": False, "error": "Docker daemon is unavailable"}
    try:
        info = client.info()
        return {
            "available": True,
            "version": info.get("ServerVersion"),
            "containers": info.get("Containers"),
            "running": info.get("ContainersRunning"),
        }
    except DockerException as error:
        return {"available": False, "error": f"Could not query Docker daemon: {error}"}
