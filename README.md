# ouch

> *"Ouch"* — named after the finger-touch scene in E.T.

Interactive web app for **Franka Panda robot base-placement optimisation**.
Place target end-effector poses in a 3D scene, click a button, and the system
finds the (x, y, yaw) base placement that lets the robot reach the most targets.

---

## Quick start

### Prerequisites

| Tool | Notes |
|------|-------|
| Docker + Docker Compose | v2+ (`docker compose` command) |

### Run

```bash
git clone <repo>
cd ouch
docker compose up --build
```

Open [http://localhost:5173](http://localhost:5173).

- Backend API: [http://localhost:8000](http://localhost:8000)
- Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The backend image builds a Python 3.10 virtualenv and installs `pin`
(Pinocchio via PyPI), `example-robot-data`, FastAPI, scipy, etc.
Backend source is bind-mounted for hot-reload during development.

---

## How to use

| Action | Effect |
|--------|--------|
| **Left-click** on the floor | Place a target end-effector pose |
| **Right-click** on a sphere | Remove that target |
| **Optimise** button | Find the best robot base placement |
| **Grid res** slider | Trade optimisation accuracy for speed |
| **Clear** button | Remove all targets |

Target spheres are coloured:
- **Grey** — reachability not yet checked
- **Green** — reachable at current base pose
- **Red** — not reachable at current base pose

---

## API overview

All endpoints are served at `http://localhost:8000/api`.
Interactive docs available at `http://localhost:8000/docs`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/robot/info` | Static robot metadata |
| POST | `/api/robot/fk` | Forward kinematics |
| POST | `/api/targets/reachability` | Reachability check for a list of targets at a given base |
| POST | `/api/optimize` | Find best base pose |
| GET | `/health` | Health check |

### Example: check reachability

```json
POST /api/targets/reachability
{
  "targets": [
    {
      "id": "abc",
      "pose": {
        "translation": [0.4, 0.1, 0.5],
        "rotation": [[1,0,0],[0,-1,0],[0,0,-1]]
      }
    }
  ],
  "base": { "x": 0.0, "y": 0.0, "yaw": 0.0 }
}
```

### Example: optimise

```json
POST /api/optimize
{
  "targets": [...],
  "x_range": [-2, 2],
  "y_range": [-2, 2],
  "yaw_range": [0, 6.2832],
  "grid_resolution": 10,
  "refine": true
}
```

---

## Optimisation method

**Phase 1 — Coarse grid search**

A regular grid over (x, y, yaw) is enumerated.  For each candidate base
pose, IK is solved for every target pose (damped least-squares, 80 iterations,
1 random seed for speed).  Candidates are ranked by
`reachable_count − ε·sum_residuals`.

**Phase 2 — Local refinement (scipy)**

The top-5 grid candidates are each refined using `scipy.optimize.minimize`
(L-BFGS-B, bounded).  The best refined solution is returned.

**IK algorithm**

Damped least-squares (Levenberg-Marquardt flavour) in the robot's base frame.
Error metric: `||log_6(T_current^-1 T_desired)||`.
Joint limits are clamped after each step.
Multiple random seeds are tried for the final full evaluation.

---

## Project structure

```
ouch/
├── backend/
│   ├── main.py                  FastAPI app + all endpoints
│   ├── robot/
│   │   ├── model.py             Robot model loading (Pinocchio + erd)
│   │   └── kinematics.py        FK, IK, reachability
│   ├── optimization/
│   │   └── base_optimizer.py    Grid search + scipy refinement
│   └── api/
│       └── schemas.py           Pydantic request/response schemas
└── frontend/
    └── src/
        ├── App.tsx              Root component
        ├── store/useStore.ts    Zustand global state + async actions
        ├── api/client.ts        fetch() wrappers for each endpoint
        ├── utils/poses.ts       SE3 utilities, coordinate helpers
        └── components/
            ├── Scene3D.tsx      react-three-fiber canvas
            ├── RobotVisual.tsx  Stick-figure robot from FK data
            ├── TargetPose.tsx   Target sphere + RGB axes
            ├── GroundPlane.tsx  Clickable ground mesh
            ├── BasePoseVisual   Base frame disc + axes
            └── Sidebar.tsx      Control panel
```

---

## Coordinate convention

**Z-up** throughout (both backend and frontend Three.js scene).

| Axis | Meaning |
|------|---------|
| X | forward (robot frame default) |
| Y | left |
| Z | up |

Ground plane is z = 0.  Default target height is 0.5 m above ground.
Default target orientation: gripper approaching from directly above
(gripper Z-axis = world -Z).

---

## Limitations & next steps

- **Mesh visualisation** — the robot is rendered as a stick figure.  Full mesh
  rendering via `urdf-loader` can be added without changing the backend.
- **Collision avoidance** — self-collision and environment collision are not
  checked.  Pinocchio's collision module can be integrated.
- **Orientation freedom** — IK checks the full SE(3) pose.  A position-only
  mode (ignoring orientation) would make more targets reachable and can be
  toggled via an API flag.
- **Drag to move targets** — react-three/drei `<DragControls>` can replace
  the current click-to-place workflow.
- **Global optimizer** — the grid+scipy approach is a practical first pass.
  A CMA-ES or basin-hopping solver would be more robust.
- **Multi-robot** — the backend is structured to swap robots; add a new branch
  in `robot/model.py` and expose a `/api/robot/load` endpoint.
