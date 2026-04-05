"""
Base-pose optimiser: find (x, y, yaw) that maximises reachable target count.

Strategy — brute-force grid search:
  Enumerate every point on a regular (x, y, yaw) grid.
  For each candidate evaluate IK for all targets.
  Score each candidate by (reachable_count, -sum_residuals).
  Return the highest-scoring grid point.
"""

from __future__ import annotations
from dataclasses import dataclass
import numpy as np
import pinocchio as pin

from ..robot.model import RobotModel
from ..robot.kinematics import check_reachability, make_base_transform
from ..api.schemas import ReachabilityResult, TargetPose, BasePose


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class OptimResult:
    base: BasePose
    results: list[ReachabilityResult]
    reachable_count: int
    score: float
    method: str


# ---------------------------------------------------------------------------
# Score function
# ---------------------------------------------------------------------------

# Small weight on residual sum for tie-breaking; must not dominate count
_RESIDUAL_WEIGHT = 1e-3
_RESIDUAL_CAP = 10.0  # cap per-target residual to avoid outlier domination


def _score(reachable_count: int, residuals: list[float]) -> float:
    """
    Primary: number of reachable targets (higher = better).
    Secondary: negative sum of capped residuals (lower residual = better).
    """
    sec = _RESIDUAL_WEIGHT * sum(min(r, _RESIDUAL_CAP) for r in residuals)
    return float(reachable_count) - sec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _targets_to_se3(targets: list[TargetPose]) -> list[tuple[str, pin.SE3]]:
    """Convert API TargetPose list to (id, pin.SE3) pairs."""
    result = []
    for t in targets:
        R = np.array(t.pose.rotation, dtype=float)
        tr = np.array(t.pose.translation, dtype=float)
        result.append((t.id, pin.SE3(R, tr)))
    return result


def _evaluate_base(
    robot: RobotModel,
    id_se3_pairs: list[tuple[str, pin.SE3]],
    x: float,
    y: float,
    yaw: float,
    n_seeds: int = 3,
) -> tuple[list[ReachabilityResult], float]:
    """Evaluate a single base pose: run IK for each target, return results + score."""
    base_world = make_base_transform(x, y, yaw)
    results: list[ReachabilityResult] = []
    residuals: list[float] = []
    reachable_count = 0

    for tid, target_se3 in id_se3_pairs:
        ok, q_sol, res = check_reachability(
            robot, target_se3, base_world, n_seeds=n_seeds, fast=True
        )
        results.append(
            ReachabilityResult(
                target_id=tid,
                reachable=ok,
                residual=res,
                q_solution=q_sol.tolist() if q_sol is not None else None,
            )
        )
        residuals.append(res)
        if ok:
            reachable_count += 1

    return results, _score(reachable_count, residuals)


# ---------------------------------------------------------------------------
# Main optimiser entry point
# ---------------------------------------------------------------------------

def optimise(
    robot: RobotModel,
    targets: list[TargetPose],
    x_range: tuple[float, float] = (-2.0, 2.0),
    y_range: tuple[float, float] = (-2.0, 2.0),
    yaw_range: tuple[float, float] = (0.0, 2 * np.pi),
    grid_resolution: int = 10,
) -> OptimResult:
    """
    Brute-force grid search: evaluate every (x, y, yaw) grid point and
    return the one with the highest reachability score.
    """
    if not targets:
        raise ValueError("No targets provided for optimisation.")

    id_se3_pairs = _targets_to_se3(targets)

    xs = np.linspace(*x_range, grid_resolution)
    ys = np.linspace(*y_range, grid_resolution)
    # yaw: don't include endpoint to avoid duplicate 0/2π
    yaws = np.linspace(*yaw_range, grid_resolution, endpoint=False)

    best_x, best_y, best_yaw = float(xs[0]), float(ys[0]), float(yaws[0])
    best_results: list[ReachabilityResult] = []
    best_score = float("-inf")

    for x in xs:
        for y in ys:
            for yaw in yaws:
                results, score = _evaluate_base(
                    robot, id_se3_pairs, float(x), float(y), float(yaw), n_seeds=1
                )
                if score > best_score:
                    best_score = score
                    best_x, best_y, best_yaw = float(x), float(y), float(yaw)
                    best_results = results

    reachable_count = sum(1 for r in best_results if r.reachable)

    return OptimResult(
        base=BasePose(x=best_x, y=best_y, yaw=best_yaw),
        results=best_results,
        reachable_count=reachable_count,
        score=best_score,
        method="grid",
    )
