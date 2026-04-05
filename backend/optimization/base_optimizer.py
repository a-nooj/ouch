"""
Base-pose optimiser: find (x, y, yaw) that maximises reachable target count.

Strategy (two-phase):
  Phase 1 — Coarse grid search
    Enumerate a regular grid over (x, y, yaw).
    Score each candidate by (reachable_count, -sum_residuals).
    Keep the top-K candidates.

  Phase 2 — Local refinement (optional)
    Run scipy.optimize.minimize (L-BFGS-B) starting from each top-K candidate.
    The objective is the continuous score: reachable_count − ε·sum_residuals,
    which gives a differentiable proxy for the discrete count.

Design notes:
  - The score function is modular; swap it out to plug in a different metric.
  - IK during grid search uses fewer iterations (fast=True) for speed.
  - IK during refinement uses full iterations for accuracy.
  - n_seeds=1 during batch optimisation (speed); n_seeds=3 for UI checks.
"""

from __future__ import annotations
from dataclasses import dataclass
import numpy as np
from scipy.optimize import minimize
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
    fast: bool = True,
    n_seeds: int = 1,
) -> tuple[list[ReachabilityResult], float]:
    """Evaluate a single base pose: run IK for each target, return results + score."""
    base_world = make_base_transform(x, y, yaw)
    results: list[ReachabilityResult] = []
    residuals: list[float] = []
    reachable_count = 0

    for tid, target_se3 in id_se3_pairs:
        ok, q_sol, res = check_reachability(
            robot, target_se3, base_world, n_seeds=n_seeds, fast=fast
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
# Grid search
# ---------------------------------------------------------------------------

def grid_search(
    robot: RobotModel,
    targets: list[TargetPose],
    x_range: tuple[float, float] = (-2.0, 2.0),
    y_range: tuple[float, float] = (-2.0, 2.0),
    yaw_range: tuple[float, float] = (0.0, 2 * np.pi),
    resolution: int = 10,
    top_k: int = 5,
) -> list[tuple[float, float, float, float]]:
    """
    Coarse grid search.

    Returns the top-K (x, y, yaw, score) tuples sorted by score descending.
    """
    id_se3_pairs = _targets_to_se3(targets)

    xs = np.linspace(*x_range, resolution)
    ys = np.linspace(*y_range, resolution)
    # yaw: don't include endpoint to avoid duplicate 0/2π
    yaws = np.linspace(*yaw_range, resolution, endpoint=False)

    candidates: list[tuple[float, float, float, float]] = []

    for x in xs:
        for y in ys:
            for yaw in yaws:
                _, score = _evaluate_base(
                    robot, id_se3_pairs, float(x), float(y), float(yaw),
                    fast=True, n_seeds=1,
                )
                candidates.append((float(x), float(y), float(yaw), score))

    candidates.sort(key=lambda c: c[3], reverse=True)
    return candidates[:top_k]


# ---------------------------------------------------------------------------
# Local refinement
# ---------------------------------------------------------------------------

def local_refine(
    robot: RobotModel,
    targets: list[TargetPose],
    x0: float,
    y0: float,
    yaw0: float,
    x_range: tuple[float, float] = (-2.0, 2.0),
    y_range: tuple[float, float] = (-2.0, 2.0),
    yaw_range: tuple[float, float] = (0.0, 2 * np.pi),
) -> tuple[float, float, float, float]:
    """
    L-BFGS-B local refinement starting from (x0, y0, yaw0).

    Returns (x, y, yaw, score).
    """
    id_se3_pairs = _targets_to_se3(targets)

    def neg_score(params: np.ndarray) -> float:
        x, y, yaw = params
        _, s = _evaluate_base(
            robot, id_se3_pairs, x, y, yaw, fast=False, n_seeds=1
        )
        return -s

    bounds = [x_range, y_range, yaw_range]
    res = minimize(
        neg_score,
        x0=[x0, y0, yaw0],
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": 50, "ftol": 1e-6, "eps": 0.05},
    )
    x, y, yaw = res.x
    score = -float(res.fun)
    return float(x), float(y), float(yaw), score


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
    refine: bool = True,
) -> OptimResult:
    """
    Two-phase optimiser: grid search → optional scipy refinement.

    Returns the best base pose found and per-target reachability results.
    """
    if not targets:
        raise ValueError("No targets provided for optimisation.")

    # Phase 1: coarse grid
    top_k = min(5, grid_resolution)
    candidates = grid_search(
        robot, targets, x_range, y_range, yaw_range,
        resolution=grid_resolution, top_k=top_k,
    )

    best_x, best_y, best_yaw, best_score = candidates[0]

    # Phase 2: local refinement on each top-K candidate
    if refine:
        for x0, y0, yaw0, _ in candidates:
            rx, ry, ryaw, rscore = local_refine(
                robot, targets, x0, y0, yaw0, x_range, y_range, yaw_range
            )
            if rscore > best_score:
                best_score = rscore
                best_x, best_y, best_yaw = rx, ry, ryaw

    # Final full evaluation at best pose
    id_se3_pairs = _targets_to_se3(targets)
    final_results, final_score = _evaluate_base(
        robot, id_se3_pairs, best_x, best_y, best_yaw,
        fast=False, n_seeds=3,
    )
    reachable_count = sum(1 for r in final_results if r.reachable)

    return OptimResult(
        base=BasePose(x=best_x, y=best_y, yaw=best_yaw),
        results=final_results,
        reachable_count=reachable_count,
        score=final_score,
        method="grid+scipy" if refine else "grid",
    )
