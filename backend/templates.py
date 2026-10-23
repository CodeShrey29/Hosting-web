"""Deployment templates for common stacks."""

TEMPLATES = {
    "python": {
        "name": "Python",
        "image": "python:3.11-slim",
        "command": "python -m http.server 8000",
        "port": 8000,
        "description": "Python app with HTTP server",
    },
    "nodejs": {
        "name": "Node.js",
        "image": "node:20-alpine",
        "command": "node server.js",
        "port": 3000,
        "description": "Node.js application",
    },
    "website": {
        "name": "Static Website",
        "image": "nginx:alpine",
        "command": None,
        "port": 80,
        "description": "Static HTML/CSS/JS site",
    },
    "minecraft": {
        "name": "Minecraft",
        "image": "itzg/minecraft-server",
        "command": None,
        "port": 25565,
        "env": {"EULA": "TRUE", "TYPE": "PAPER"},
        "description": "Minecraft server (Paper)",
    },
    "docker": {
        "name": "Custom Docker",
        "image": "alpine",
        "command": "sleep infinity",
        "port": None,
        "description": "Custom Docker image",
    },
}

def get_template(name: str):
    return TEMPLATES.get(name)

def list_templates():
    return [{"id": k, **v} for k, v in TEMPLATES.items()]
