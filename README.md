# Hosting Platform — Local PC Edition

Real control plane + Docker worker that runs entirely on your PC.

## Start

```bash
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python hosting.py
```

Open http://localhost:5000

## What works now
- SQLite database (data/hosting.db) — stays on the PC
- Real Docker integration (start/stop containers with RAM limits)
- Resource reservation on the local worker
- Projects stored and tracked
- Frontend connected to live API
- `/api/status`, `/api/projects`, deploy flow

## Requirements
- Python 3.10+
- Docker running on the same machine
- Node.js (only for building frontend)

Everything stays on this PC. No external database or cloud required.

Next steps from the full prompt: better scheduler, storage volumes, metering, auth, and plan enforcement.
