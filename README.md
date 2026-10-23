# Cloud Host control plane

Cloud Host currently has a React dashboard and a Flask API. The dashboard reads projects, plans, worker status, and deployment templates from the API; it does not fabricate utilization charts or a Render worker.

## Run locally

Requirements: Python dependencies, Node.js/npm, and Docker for container provisioning.

```bash
python hosting.py
```

`hosting.py` builds the frontend if its generated assets are missing. The local server binds to `127.0.0.1` by default. If binding to a non-loopback `HOSTING_HOST`, configure `ADMIN_EMAIL` and `ADMIN_PASSWORD`; startup fails closed without them and authenticated sessions require HTTPS. To build the frontend explicitly:

```bash
cd frontend
npm ci
npm run build
```

The local SQLite database and workload data live under `data/`. Deployments require a working local Docker daemon and a non-root service account. Workload containers run as that same non-root UID/GID with all Linux capabilities dropped; if the control plane itself runs as root, set `WORKLOAD_UID` and `WORKLOAD_GID` to a valid non-root account or workload creation fails closed. Local website, Python, and Node.js HTTP ports are published on `127.0.0.1` only, not exposed to your LAN or the public internet. The project file manager reads and writes each workload's managed volume, enforces its configured file-manager storage allocation, and supports safe text editing and file upload/download. The Node.js template creates an editable starter server in that volume.

## Deploy on Render

The checked-in `render.yaml` installs Python dependencies, runs `npm ci` and builds the React frontend, then starts the Flask app. Frontend build failures now fail the Render build instead of being ignored.

Render currently hosts the **single-administrator control plane only**. The blueprint sets the initial login name to `admin@local.host` and asks Render to generate a unique administrator password; find that generated value in the service's Environment settings, then sign in with it. You may change both values there, but keep the password at least 16 characters. Never commit credentials. The app uses secure, HTTP-only, same-site session cookies, session invalidation on password rotation, login rate limiting, CSRF checks for state-changing API requests, and browser security headers. Local development binds to loopback by default; setting `HOSTING_HOST` to a non-loopback address requires the same administrator credentials.

This repository does not enroll a remote worker or provide a Docker runtime on Render, so the UI reports no worker and deployment requests are rejected by the API. The Render blueprint now provisions a 1 GB persistent disk mounted at `/var/data`, with `DATA_DIR=/var/data` and `PERSISTENT_STORAGE=true`; the app verifies the mount before reporting persistence. This disk is intended for the control-plane SQLite database and uploads. The 1 GB capacity is limited and can fill; it is not a substitute for managed database/object storage, backups, or a production data-retention plan. Render may charge for the disk. Do not use this setup for customer data.

## Current implementation boundary

Working API-backed surfaces include project listing and lifecycle actions, template-based deployment requests, plan/usage display, and worker/runtime status. The local Docker adapter can provision containers when run on a host with Docker. Local worker memory and CPU limits account for Linux cgroups when available; disk capacity is discovered from the data volume at startup. Set `WORKER_MEMORY_LIMIT_MB`, `WORKER_CPU_LIMIT`, and `WORKER_STORAGE_LIMIT_MB` to apply stricter operator caps. Container launches apply memory, swap, CPU, process-count, dropped-capability, and no-new-privileges limits. The Monitoring page samples live Docker CPU, memory, project-volume size, and network counters without persisting a history. File-manager operations enforce the per-project allocation, but Docker writes to a bind-mounted volume are not kernel-quota-enforced; this remains a local single-administrator prototype, not safe multi-tenant storage isolation.

This is **not yet a production hosting platform**. Production use still requires, at minimum, multi-user authentication and tenant authorization, a shared durable database and object storage, an authenticated remote worker/agent, real telemetry and transfer metering, ingress and TLS, backups and restore, abuse controls, and payment-provider integration. Those services are not represented as completed features in the UI.
