"""
Ouch — Robot Base Placement Optimizer
FastAPI backend entry point.

Run with:
  uvicorn backend.main:app --reload --port 8000
(from the repo root, with the conda environment active)
"""

from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np

from .robot.model import load_robot, RobotModel
from .robot.kinematics import (
    compute_fk,
    check_reachability,
    make_base_transform,
    se3_from_dict,
)
from .optimization.base_optimizer import optimise
from .api.schemas import (
    BasePose,
    FKRequest,
    FKResponse,
    JointFrame,
    OptimizeRequest,
    OptimizeResponse,
    ReachabilityRequest,
    ReachabilityResponse,
    ReachabilityResult,
    RobotInfoResponse,
)

logger = logging.getLogger("ouch")
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading Panda robot model…")
    try:
        app.state.robot = load_robot("panda")
        logger.info(
            "Panda loaded — EE frame: %s, DOF: %d",
            app.state.robot.ee_frame_name,
            app.state.robot.model.nv,
        )
    except Exception as exc:
        logger.error("Failed to load robot: %s", exc)
        app.state.robot = None
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Ouch — Robot Base Placement Optimizer",
    description="Interactive Franka Panda base-placement optimization API.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Dependency helper
# ---------------------------------------------------------------------------

def _get_robot(request: Request) -> RobotModel:
    robot: RobotModel | None = getattr(request.app.state, "robot", None)
    if robot is None:
        raise HTTPException(
            status_code=503,
            detail="Robot model not loaded. Check backend logs for errors.",
        )
    return robot


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/robot/info", response_model=RobotInfoResponse, tags=["robot"])
def robot_info(request: Request):
    """Return static robot metadata: joint names, limits, neutral config."""
    robot = _get_robot(request)
    model = robot.model
    return RobotInfoResponse(
        name=robot.name,
        n_joints=model.nv,
        joint_names=list(model.names[1:]),  # skip universe joint
        joint_lower_limits=model.lowerPositionLimit.tolist(),
        joint_upper_limits=model.upperPositionLimit.tolist(),
        ee_frame_name=robot.ee_frame_name,
        neutral_config=robot.neutral_config.tolist(),
    )


@app.post("/api/robot/fk", response_model=FKResponse, tags=["robot"])
def forward_kinematics(body: FKRequest, request: Request):
    """
    Compute forward kinematics.

    Returns all visualisation frame poses in the world frame.
    Input `base` is the planar robot-base pose (x, y, yaw in Z-up world).
    """
    robot = _get_robot(request)
    q = np.array(body.q, dtype=float)
    if len(q) != robot.model.nq:
        raise HTTPException(
            status_code=422,
            detail=f"Expected q of length {robot.model.nq}, got {len(q)}.",
        )

    base = make_base_transform(body.base.x, body.base.y, body.base.yaw)
    frames = compute_fk(robot, q, base)

    joints = [
        JointFrame(
            name=name,
            position=se3.translation.tolist(),
            rotation=se3.rotation.tolist(),
        )
        for name, se3 in frames.items()
        if name != robot.ee_frame_name
    ]
    ee_se3 = frames[robot.ee_frame_name]
    ee = JointFrame(
        name=robot.ee_frame_name,
        position=ee_se3.translation.tolist(),
        rotation=ee_se3.rotation.tolist(),
    )
    return FKResponse(joints=joints, ee=ee)


@app.post("/api/targets/reachability", response_model=ReachabilityResponse, tags=["targets"])
def check_targets_reachability(body: ReachabilityRequest, request: Request):
    """
    Check reachability of each target pose from a given robot base pose.

    Uses multi-seed IK; each target is checked independently.
    """
    robot = _get_robot(request)
    base_world = make_base_transform(body.base.x, body.base.y, body.base.yaw)

    results: list[ReachabilityResult] = []
    for target in body.targets:
        target_se3 = se3_from_dict(target.pose.translation, target.pose.rotation)
        ok, q_sol, residual = check_reachability(
            robot, target_se3, base_world, n_seeds=body.n_seeds, fast=False
        )
        results.append(
            ReachabilityResult(
                target_id=target.id,
                reachable=ok,
                residual=residual,
                q_solution=q_sol.tolist() if q_sol is not None else None,
            )
        )

    return ReachabilityResponse(results=results, base=body.base)


@app.post("/api/optimize", response_model=OptimizeResponse, tags=["optimization"])
def optimize_base_pose(body: OptimizeRequest, request: Request):
    """
    Find the robot base pose (x, y, yaw) that maximises the number of
    reachable target poses.

    Brute-force grid search over (x, y, yaw); returns the best grid point.
    """
    robot = _get_robot(request)

    if not body.targets:
        raise HTTPException(status_code=422, detail="Provide at least one target.")

    result = optimise(
        robot=robot,
        targets=body.targets,
        x_range=tuple(body.x_range),      # type: ignore[arg-type]
        y_range=tuple(body.y_range),       # type: ignore[arg-type]
        yaw_range=tuple(body.yaw_range),   # type: ignore[arg-type]
        grid_resolution=body.grid_resolution,
    )

    n = len(body.targets)
    frac = result.reachable_count / n if n else 0.0

    return OptimizeResponse(
        base=result.base,
        results=result.results,
        total_targets=n,
        reachable_count=result.reachable_count,
        reachable_fraction=frac,
        score=result.score,
        method=result.method,
    )


@app.get("/api/robot/urdf", tags=["robot"])
def get_urdf(request: Request):
    """Return the raw URDF XML for the loaded robot."""
    robot = _get_robot(request)
    return FileResponse(robot.urdf_path, media_type="application/xml")


@app.get("/api/robot/meshes/{filepath:path}", tags=["robot"])
def get_mesh(filepath: str, request: Request):
    """Serve mesh assets (DAE/STL/OBJ) referenced by the URDF."""
    robot = _get_robot(request)
    file_path = (robot.mesh_base_dir / filepath).resolve()
    if not file_path.is_relative_to(robot.mesh_base_dir.resolve()):
        raise HTTPException(status_code=404, detail="File not found")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok"}
