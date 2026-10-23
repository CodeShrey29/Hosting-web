# Hosting Platform — Local PC Edition

A high-quality, production-oriented cloud hosting platform UI that runs entirely on your own PC.

No external databases or cloud services are required for this version. Everything stays on your machine.

## Tech Stack
- React 18 + TypeScript
- Vite
- Tailwind CSS (dark/light mode)
- React Router
- Lucide icons

## Features
- Premium dashboard with resource cards
- Full sidebar (Overview, Host, Projects, Infrastructure, Account)
- Deploy page with source options
- Local worker status panel
- Responsive layout
- Theme toggle

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Then open **http://localhost:5173**

## Next Steps
This is the solid frontend foundation. The next pieces (still fully local on your PC) will be:
- Local backend API
- Docker worker agent
- Real resource limits and metering
- File uploads and project detection

All designed so it can later scale beyond a single PC.
