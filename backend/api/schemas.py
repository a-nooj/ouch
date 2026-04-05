"""
Pydantic schemas for all API request/response models.

Coordinate convention:
  All poses use Z-up (robotics standard).
  Rotation matrices are stored row-major as List[List[float]] (3x3).
  Quaternions are [x, y, z, w].
"""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Primitive pose types
# ---------------------------------------------------------------------------

class Vec3(BaseModel):
    x: float
    y: float
    z: float


class SE3(BaseModel):
    """Full 6-DOF pose: translation (x,y,z) + 3×3 rotation matrix (row-major)."""
    translation: list[float] = Field(..., min_length=3, max_length=3)
    rotation: list[list[float]] = Field(
        ..., description="Row-major 3x3 rotation matrix"
    )


class BasePose(BaseModel):
    """Planar robot-base pose on the ground plane."""
    x: float = 0.0
    y: float = 0.0
    yaw: float = 0.0  # radians, rotation about Z


# ---------------------------------------------------------------------------
# Request / response bodies
# ---------------------------------------------------------------------------

class TargetPose(BaseModel):
    id: str
    pose: SE3


class FKRequest(BaseModel):
    q: list[float]          # Joint configuration (all DOF)
    base: BasePose


class JointFrame(BaseModel):
    """A named frame's pose in world space, returned by FK."""
    name: str
    position: list[float]           # [x, y, z]
    rotation: list[list[float]]     # 3×3 rotation matrix


class FKResponse(BaseModel):
    joints: list[JointFrame]
    ee: JointFrame


class ReachabilityRequest(BaseModel):
    targets: list[TargetPose]
    base: BasePose
    n_seeds: int = Field(3, ge=1, le=10, description="IK random seeds per target")


class ReachabilityResult(BaseModel):
    target_id: str
    reachable: bool
    residual: float
    q_solution: Optional[list[float]] = None


class ReachabilityResponse(BaseModel):
    results: list[ReachabilityResult]
    base: BasePose


class OptimizeRequest(BaseModel):
    targets: list[TargetPose]
    # Search bounds for the base
    x_range: list[float] = Field([-2.0, 2.0], min_length=2, max_length=2)
    y_range: list[float] = Field([-2.0, 2.0], min_length=2, max_length=2)
    yaw_range: list[float] = Field([0.0, 6.2832], min_length=2, max_length=2)
    grid_resolution: int = Field(10, ge=3, le=30, description="Points per axis in grid search")


class OptimizeResponse(BaseModel):
    base: BasePose
    results: list[ReachabilityResult]
    total_targets: int
    reachable_count: int
    reachable_fraction: float
    score: float
    method: str = "grid"


class RobotInfoResponse(BaseModel):
    name: str
    n_joints: int
    joint_names: list[str]
    joint_lower_limits: list[float]
    joint_upper_limits: list[float]
    ee_frame_name: str
    neutral_config: list[float]
