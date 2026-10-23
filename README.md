# Hosting Platform — Local PC Edition

High-quality frontend + simple Python entry point. Designed for your PC, testable on Render.

## Start with one command

```bash
python hosting.py
```

(If the frontend is not built yet, first run:)

```bash
cd frontend
npm install
npm run build
cd ..
python hosting.py
```

Then open http://localhost:5000

## On Render
- Build command: `cd frontend && npm install && npm run build`
- Start command: `python hosting.py`
- It serves the built frontend + simple local API stubs.

## Features
- Premium dashboard
- Servers, Monitoring, Billing, Settings pages
- Deploy flow
- Dark/light mode
- Everything stays local / on the machine it runs on

Next: real local Docker worker and resource enforcement.
