# Hosting Platform — Local PC Edition

Just run:

```bash
python hosting.py
```

## What works now
- Real control plane (SQLite)
- Docker containers with RAM limits + persistent volumes
- Plan enforcement (Free: 512 MB RAM, 1 GB storage, 3 deployments)
- Resource reservation on local worker
- File upload endpoint
- Live dashboard showing real usage vs plan limits
- Auto-builds frontend on first run

## Data location (on your PC)
- Database: `data/hosting.db`
- Volumes: `data/volumes/`
- Uploads: `data/uploads/`

Everything stays on this machine. Docker required for real deployments.
