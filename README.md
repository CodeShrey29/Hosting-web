# Hosting Platform — Local PC Edition

```bash
python hosting.py
```

## Features now
- Simple local auth (`POST /api/auth/login`)
- ZIP upload → extract into volume → deploy
- Container logs (`GET /api/projects/<id>/logs`)
- Plan enforcement (RAM / storage / deployment limits)
- Persistent volumes in `data/volumes/`
- Stop / Delete projects from the UI
- Live dashboard with real usage
- Auto-builds frontend on first run

## Data (stays on your PC)
- `data/hosting.db`
- `data/volumes/`
- `data/uploads/`

Docker required for real containers.
Optional login secret: `local-pc-secret`
