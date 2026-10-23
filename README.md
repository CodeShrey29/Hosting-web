# Hosting Platform — Local PC Edition

Just run one command:

```bash
python hosting.py
```

It will automatically:
1. Install Python dependencies if needed
2. Build the frontend the first time (requires Node.js)
3. Start the control plane + serve the UI

Open http://localhost:5000

## Requirements
- Python 3.10+
- Node.js + npm (only for the first frontend build)
- Docker (for real container deployments)

Everything stays on your PC. SQLite database in `data/hosting.db`.
