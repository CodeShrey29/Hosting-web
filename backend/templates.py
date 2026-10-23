"""Deployment templates for common stacks."""

TEMPLATES = {
    "python": {
        "name": "Python",
        "image": "python:3.11-slim",
        "command": "python -m http.server 8000 --directory /data",
        "port": 8000,
        "description": "Python app with HTTP server",
    },
    "nodejs": {
        "name": "Node.js",
        "image": "node:20-alpine",
        "command": "node /data/server.js",
        "port": 3000,
        "env": {"PORT": "3000"},
        "starter_files": {
            "server.js": """const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = '/data';
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Invalid request path');
    return;
  }

  const requested = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(requested, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end('Not found. Add an index.html or edit server.js in the project file manager.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(requested).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(requested).pipe(response);
  });
}).listen(Number(process.env.PORT || 3000), '0.0.0.0');
""",
        },
        "description": "Node.js application",
    },
    "website": {
        "name": "Static Website",
        "image": "nginxinc/nginx-unprivileged:alpine",
        "command": None,
        "port": 8080,
        "volume_target": "/usr/share/nginx/html",
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
    return [
        {"id": key, **{name: value for name, value in template.items() if name != "starter_files"}}
        for key, template in TEMPLATES.items()
    ]
