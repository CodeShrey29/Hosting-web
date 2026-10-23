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

The local SQLite database and workload data live under `data/`. Deployments require a working local Docker daemon.

## Deploy on Render

The checked-in `render.yaml` installs Python dependencies, runs `npm ci` and builds the React frontend, then starts the Flask app. Frontend build failures now fail the Render build instead of being ignored.

Render currently hosts the **single-administrator control plane only**. Set `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least 16 characters in the Render service environment before signing in. The app uses secure, HTTP-only, same-site session cookies, session invalidation on password rotation, login rate limiting, CSRF checks for state-changing API requests, and browser security headers. Local development binds to loopback by default; setting `HOSTING_HOST` to a non-loopback address requires the same administrator credentials.

This repository does not enroll a remote worker or provide a Docker runtime on Render, so the UI reports no worker and deployment requests are rejected by the API. Render's filesystem is ephemeral unless a persistent disk is configured. To persist this service, attach a Render disk at `/var/data`, set `DATA_DIR=/var/data`, and set `PERSISTENT_STORAGE=true`; the app verifies the directory is mounted before reporting persistence. Without all three, SQLite state and uploads may be lost on restart or redeploy. The disk is a Render resource and may incur charges. Do not use this setup for customer data.

## Current implementation boundary

Working API-backed surfaces include project listing and lifecycle actions, template-based deployment requests, plan/usage display, and worker/runtime status. The local Docker adapter can provision containers when run on a host with Docker. Local worker memory and CPU limits account for Linux cgroups when available; disk capacity is discovered from the data volume at startup. Set `WORKER_MEMORY_LIMIT_MB`, `WORKER_CPU_LIMIT`, and `WORKER_STORAGE_LIMIT_MB` to apply stricter operator caps. Container launches apply memory, swap, CPU, process-count, dropped-capability, and no-new-privileges limits.

This is **not yet a production hosting platform**. Production use still requires, at minimum, multi-user authentication and tenant authorization, a shared durable database and object storage, an authenticated remote worker/agent, real telemetry and transfer metering, ingress and TLS, backups and restore, abuse controls, and payment-provider integration. Those services are not represented as completed features in the UI.
