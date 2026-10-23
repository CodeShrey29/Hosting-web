"""Local Docker worker with volume + env support."""
import logging
import docker
from docker.errors import DockerException, ImageNotFound
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def workload_user():
    configured_uid = os.environ.get("WORKLOAD_UID")
    configured_gid = os.environ.get("WORKLOAD_GID")
    if configured_uid is not None or configured_gid is not None:
        try:
            uid = int(configured_uid)
            gid = int(configured_gid)
        except (TypeError, ValueError):
            raise ValueError("WORKLOAD_UID and WORKLOAD_GID must both be valid integers.")
        if uid <= 0 or gid < 0:
            raise ValueError("Workloads must run as a non-root user.")
        return f"{uid}:{gid}"
    if hasattr(os, "getuid"):
        uid = os.getuid()
        if uid == 0:
            raise ValueError("Refusing to run workloads as root. Configure a non-root WORKLOAD_UID and WORKLOAD_GID.")
        return f"{uid}:{os.getgid()}"
    return "65532:65532"


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
    volume_target: str = "/data",
    port: int = None,
    env: dict = None,
    command: str = None,
):
    try:
        container_user = workload_user()
    except ValueError as error:
        return {"error": str(error)}
    client = get_client()
    if not client:
        return {"error": "Docker not available"}

    volumes = {}
    if volume_path:
        Path(volume_path).mkdir(parents=True, exist_ok=True)
        volumes[str(volume_path)] = {"bind": volume_target, "mode": "rw"}

    try:
        client.images.get(image)
    except ImageNotFound:
        try:
            client.images.pull(image)
        except DockerException as error:
            return {"error": f"Could not pull container image {image}: {error}"}
    except DockerException as error:
        return {"error": f"Could not verify container image {image}: {error}"}

    try:
        kwargs = {
            "detach": True,
            "name": name,
            "mem_limit": f"{ram_mb}m",
            "memswap_limit": f"{ram_mb}m",
            "nano_cpus": int(cpu_limit * 1_000_000_000),
            "pids_limit": 256,
            "user": container_user,
            "cap_drop": ["ALL"],
            "security_opt": ["no-new-privileges:true"],
            "tmpfs": {"/tmp": "rw,noexec,nosuid,size=64m"},
            "environment": {**(env or {}), **({"PORT": str(port)} if port else {})},
            "volumes": volumes,
            "ports": {f"{port}/tcp": ("127.0.0.1", None)} if port else None,
            "restart_policy": {"Name": "unless-stopped"},
            "labels": {"hosting.managed": "true"},
        }
        if command:
            kwargs["command"] = command
        container = client.containers.run(image, **kwargs)
        published_port = None
        if port:
            container.reload()
            binding = container.attrs.get("NetworkSettings", {}).get("Ports", {}).get(f"{port}/tcp")
            if binding:
                published_port = int(binding[0]["HostPort"])
        return {
            "id": container.id[:12],
            "name": container.name,
            "status": container.status,
            "host_port": published_port,
        }
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

def restart_container(name_or_id: str, timeout: int = 10):
    client = get_client()
    if not client:
        return {"error": "Docker unavailable"}
    try:
        container = client.containers.get(name_or_id)
        container.restart(timeout=timeout)
        return {"status": "running"}
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

def container_metrics(name_or_id: str, client=None):
    client = client or get_client()
    if not client:
        return {"error": "Docker daemon is unavailable"}
    try:
        container = client.containers.get(name_or_id)
        stats = container.stats(stream=False)
    except DockerException as error:
        logger.warning("Could not read Docker stats for %s: %s", name_or_id, error)
        return {"error": "Container metrics are unavailable"}

    cpu_stats = stats.get("cpu_stats", {})
    previous_cpu_stats = stats.get("precpu_stats", {})
    cpu_usage = cpu_stats.get("cpu_usage", {})
    previous_cpu_usage = previous_cpu_stats.get("cpu_usage", {})
    cpu_delta = cpu_usage.get("total_usage", 0) - previous_cpu_usage.get("total_usage", 0)
    system_delta = cpu_stats.get("system_cpu_usage", 0) - previous_cpu_stats.get("system_cpu_usage", 0)
    cpu_count = cpu_stats.get("online_cpus") or len(cpu_usage.get("percpu_usage", [])) or 1
    cpu_percent = max(0.0, cpu_delta / system_delta * cpu_count * 100) if system_delta > 0 else 0.0

    memory_stats = stats.get("memory_stats", {})
    memory_details = memory_stats.get("stats", {})
    inactive_cache = memory_details.get("inactive_file", memory_details.get("cache", 0))
    memory_used = max(0, memory_stats.get("usage", 0) - inactive_cache)
    network_stats = stats.get("networks", {}).values()
    network = {
        "ingress_bytes": sum(interface.get("rx_bytes", 0) for interface in network_stats),
        "egress_bytes": sum(interface.get("tx_bytes", 0) for interface in network_stats),
    }
    return {
        "cpu_percent": round(cpu_percent, 2),
        "memory_usage_bytes": memory_used,
        "memory_limit_bytes": memory_stats.get("limit", 0),
        **network,
    }
