"""
Forward kinematics (pinocchio) + Inverse kinematics (ikpy).

IK design:
  ikpy solves IK directly from the URDF chain using scipy.optimize under the
  hood, respecting joint limits automatically.  We transform the target pose
  into the robot's base frame before calling ikpy, so the virtual planar base
  joint is handled transparently.

  orientation_mode='all'  → full SE(3) IK (position + orientation)
  orientation_mode=None   → position-only IK (more permissive, higher reach)

Base pose convention (Z-up):
  make_base_transform(x, y, yaw) returns an SE3 that maps robot-root coords
  to world coords.  Targets are given in world coords and transformed to
  robot-root coords before IK.
"""

from __future__ import annotations
import warnings
from typing import Optional
import numpy as np
import pinocchio as pin

from .model import RobotModel


# ---------------------------------------------------------------------------
# Coordinate helpers
# ---------------------------------------------------------------------------

def make_base_transform(x: float, y: float, yaw: float) -> pin.SE3:
    """SE3 pose of the robot base in the world frame (Z-up ground plane)."""
    c, s = np.cos(yaw), np.sin(yaw)
    R = np.array([[c, -s, 0.0],
                  [s,  c, 0.0],
                  [0.0, 0.0, 1.0]])
    return pin.SE3(R, np.array([x, y, 0.0]))


def se3_from_dict(translation: list[float], rotation: list[list[float]]) -> pin.SE3:
    """Convert API-level translation+rotation into a pin.SE3 object."""
    return pin.SE3(np.array(rotation, dtype=float), np.array(translation, dtype=float))


def _se3_to_mat(se3: pin.SE3) -> np.ndarray:
    """pin.SE3 → 4×4 homogeneous matrix."""
    H = np.eye(4)
    H[:3, :3] = se3.rotation
    H[:3, 3] = se3.translation
    return H


# ---------------------------------------------------------------------------
# Forward kinematics
# ---------------------------------------------------------------------------

def compute_fk(
    robot: RobotModel,
    q: np.ndarray,
    base_world: pin.SE3,
) -> dict[str, pin.SE3]:
    """
    Compute FK for all visualisation frames.
    Returns frame_name → SE3 in world frame.
    Creates its own Data to be safe under concurrent requests.
    """
    model = robot.model
    data = model.createData()
    pin.forwardKinematics(model, data, q)
    pin.updateFramePlacements(model, data)

    result: dict[str, pin.SE3] = {}
    for name in robot.viz_frame_names:
        fid = model.getFrameId(name)
        result[name] = base_world * data.oMf[fid]

    result[robot.ee_frame_name] = base_world * data.oMf[robot.ee_frame_id]
    return result


# ---------------------------------------------------------------------------
# Inverse kinematics via ikpy
# ---------------------------------------------------------------------------

def _ikpy_neutral(robot: RobotModel) -> np.ndarray:
    """
    Build a valid ikpy initial-angle vector using each joint's bound midpoint.
    This avoids the ValueError from scipy when zero lies outside a joint's limits
    (e.g. panda_joint4 has bounds (-3.07, -0.07) — zero is invalid).
    """
    angles = np.zeros(len(robot.ik_chain.links))
    for i, link in enumerate(robot.ik_chain.links):
        lo, hi = link.bounds
        if np.isfinite(lo) and np.isfinite(hi):
            angles[i] = (lo + hi) / 2.0
        elif np.isfinite(lo):
            angles[i] = lo
        elif np.isfinite(hi):
            angles[i] = hi
    return angles


def _ikpy_angles_to_q(robot: RobotModel, ikpy_angles: np.ndarray) -> np.ndarray:
    """
    Map ikpy's full-chain angle vector (one entry per chain link, including
    fixed joints with value=0) to a pinocchio q vector.

    The Panda pinocchio model has 9 DOF: 7 arm + 2 fingers.
    ikpy's chain has N links; the 7 revolute ones map to q[0:7].
    Finger joints are set to 0 (closed).
    """
    q = np.zeros(robot.model.nq)
    arm_idx = 0
    for i, (link, active) in enumerate(zip(robot.ik_chain.links, robot.ik_active_mask)):
        if active and arm_idx < 7:
            q[arm_idx] = ikpy_angles[i]
            arm_idx += 1
    return q


def solve_ik(
    robot: RobotModel,
    target_world: pin.SE3,
    base_world: pin.SE3,
    q_init: Optional[np.ndarray] = None,
    orientation_mode: str = "all",
) -> tuple[bool, np.ndarray, float]:
    """
    Solve IK using ikpy.

    Returns (success, q_solution, position_residual_metres).
    success is True when the EE reaches within 5 mm of the target position.
    """
    # Transform target into the robot's root frame
    target_base: pin.SE3 = base_world.inverse() * target_world
    target_mat = _se3_to_mat(target_base)

    # Build initial angles vector for ikpy (one value per chain link).
    # Use midpoint of each joint's bounds — zero can be outside some Panda
    # joint limits (e.g. panda_joint4 is strictly negative).
    init_angles = _ikpy_neutral(robot)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        ik_angles = robot.ik_chain.inverse_kinematics_frame(
            target_mat,
            initial_position=init_angles,
            orientation_mode=orientation_mode,
        )

    # FK with ikpy solution to check residual
    fk_mat = robot.ik_chain.forward_kinematics(ik_angles)
    pos_residual = float(np.linalg.norm(fk_mat[:3, 3] - target_base.translation))

    q_sol = _ikpy_angles_to_q(robot, ik_angles)
    q_sol = np.clip(q_sol, robot.model.lowerPositionLimit, robot.model.upperPositionLimit)

    success = pos_residual < 5e-3  # within 5 mm

    return success, q_sol, pos_residual


# ---------------------------------------------------------------------------
# Reachability check (multi-seed)
# ---------------------------------------------------------------------------

def check_reachability(
    robot: RobotModel,
    target_world: pin.SE3,
    base_world: pin.SE3,
    n_seeds: int = 3,
    fast: bool = False,
) -> tuple[bool, Optional[np.ndarray], float]:
    """
    Check reachability with multiple random IK seeds for robustness.
    fast=True uses n_seeds=1 for speed during batch optimisation.
    """
    effective_seeds = 1 if fast else n_seeds
    seeds = [robot.neutral_config.copy()]
    for _ in range(effective_seeds - 1):
        seeds.append(pin.randomConfiguration(robot.model))

    best_err = float("inf")
    best_q: Optional[np.ndarray] = None

    for q_seed in seeds:
        ok, q_sol, residual = solve_ik(robot, target_world, base_world, q_seed)
        if ok:
            return True, q_sol, residual
        if residual < best_err:
            best_err = residual
            best_q = q_sol

    return False, best_q, best_err
