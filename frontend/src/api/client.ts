/**
 * API client — thin wrappers around fetch() for each backend endpoint.
 *
 * All functions throw on HTTP error so callers can handle them uniformly.
 */

import type {
  BasePose,
  FKResponse,
  OptimizeResponse,
  ReachabilityResponse,
  RobotInfo,
  TargetPose,
} from "../types";

const BASE_URL = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

/** Fetch static robot metadata (joint names, limits, neutral config). */
export function fetchRobotInfo(): Promise<RobotInfo> {
  return get<RobotInfo>("/robot/info");
}

/** Forward kinematics: returns joint/EE frame poses in world frame. */
export function fetchFK(q: number[], base: BasePose): Promise<FKResponse> {
  return post<FKResponse>("/robot/fk", { q, base });
}

/**
 * Check reachability of each target from the given base pose.
 * `n_seeds` controls how many IK random restarts are tried.
 */
export function fetchReachability(
  targets: TargetPose[],
  base: BasePose,
  n_seeds = 3,
): Promise<ReachabilityResponse> {
  return post<ReachabilityResponse>("/targets/reachability", {
    targets,
    base,
    n_seeds,
  });
}

/** Run the base-pose optimiser and return the best pose + per-target results. */
export function fetchOptimize(
  targets: TargetPose[],
  opts: {
    x_range?: [number, number];
    y_range?: [number, number];
    yaw_range?: [number, number];
    grid_resolution?: number;
  } = {},
): Promise<OptimizeResponse> {
  return post<OptimizeResponse>("/optimize", {
    targets,
    x_range: opts.x_range ?? [-2.0, 2.0],
    y_range: opts.y_range ?? [-2.0, 2.0],
    yaw_range: opts.yaw_range ?? [0, 6.2832],
    grid_resolution: opts.grid_resolution ?? 10,
  });
}
