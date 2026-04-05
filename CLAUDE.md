# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

**Ouch** is a full-stack web app for optimizing Franka Panda robot base placement. Users place 6-DOF target end-effector poses in a 3D scene; the backend finds the (x, y, yaw) base placement that maximizes reachability via grid search + IK. Stack: FastAPI + Pinocchio (backend) / React Three Fiber + Zustand (frontend).

## Commands

### Docker (primary workflow)
```bash
./setup.sh              # Build Docker images
docker compose up       # Start both services (frontend :5173, backend :8000)
docker compose up --build   # Rebuild and start
docker compose logs -f backend   # Tail backend logs
docker compose down     # Stop
```

### Local Development (without Docker)
```bash
# Backend — requires conda for Pinocchio
conda install -c conda-forge pinocchio example-robot-data
pip install fastapi uvicorn scipy numpy ikpy
uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev        # Dev server with HMR
npm run build      # Production build
```

### API Docs
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Architecture

### Coordinate Convention
Z-up throughout (robotics standard). Three.js scene sets `THREE.Object3D.DEFAULT_UP = (0,0,1)`. Ground plane is z=0. All SE(3) poses use 3×3 rotation matrices (row-major) + translation vectors.

### Backend (`backend/`)
- **`main.py`** — FastAPI app; loads Franka Panda model at startup via `lifespan`. Five endpoints: `GET /api/robot/info`, `POST /api/robot/fk`, `POST /api/targets/reachability`, `POST /api/optimize`, `GET /health`.
- **`robot/model.py`** — Loads URDF via Pinocchio + `example-robot-data`; builds ikpy chain (arm joints only, fingers excluded).
- **`robot/kinematics.py`** — Forward kinematics (Pinocchio) and damped least-squares IK returning residual + joint solution.
- **`optimization/base_optimizer.py`** — Coarse grid search over (x, y, yaw); scores each candidate as `reachable_count - 1e-3 * sum_residuals`. scipy L-BFGS-B refinement is designed but not yet wired in.
- **`api/schemas.py`** — All Pydantic request/response models. The TypeScript types in `frontend/src/types/index.ts` mirror these exactly.

### Frontend (`frontend/src/`)
- **`store/useStore.ts`** — Single Zustand store holds all app state: `targets`, `basePose`, `fkData`, `reachabilityMap`, `optimizationResult`, error/loading flags. Async actions (`optimize`, `checkReachability`, `refreshFK`) call the API and update state.
- **`api/client.ts`** — Plain `fetch()` wrappers for the five endpoints. Dev server proxies `/api` → `http://backend:8000` (see `vite.config.ts`).
- **`components/Scene3D.tsx`** — react-three-fiber Canvas; `GroundPlane` click → `addTarget`; `RobotVisual` renders stick figure from FK data.
- **`utils/poses.ts`** — SE(3) utilities and coordinate conversion helpers.

### Data Flow
1. Click ground plane → `addTarget` → debounced `checkReachability` → `/api/targets/reachability` → update `reachabilityMap` (colors target spheres green/red).
2. Click Optimize → `fetchOptimize` → `/api/optimize` → update `basePose` → `refreshFK` → robot stick figure moves.

### Docker Networking
Both services run on `ouch-net`. Frontend Vite dev server proxies `/api` to `http://backend:8000` (the Docker service name, not `localhost`). Backend volumes mount `./backend` read-only for hot-reload.

## Key Dependencies

| Layer | Key Packages |
|-------|-------------|
| Backend | `pinocchio`, `example-robot-data`, `ikpy`, `fastapi`, `uvicorn`, `scipy` |
| Frontend | `@react-three/fiber`, `@react-three/drei`, `three`, `zustand`, `tailwindcss`, `vite` |

Pinocchio **must** be installed via conda (`-c conda-forge`), not pip, for local dev.

## Known Gaps
- scipy L-BFGS-B refinement pass is designed but not implemented in `base_optimizer.py`.
- No mesh visualization (stick figure only).
- No collision avoidance.
- IK always checks full SE(3); no position-only mode.
