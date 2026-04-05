/**
 * Shared TypeScript types mirroring the backend Pydantic schemas.
 *
 * Coordinate convention (Z-up):
 *   All 3D data uses Z-up (robotics standard), matching the backend.
 *   Three.js internally uses Y-up; the Scene3D component handles the
 *   axis swap transparently by setting the camera's up vector and
 *   adjusting the ground plane.
 */

// ── Primitive pose ──────────────────────────────────────────────────────────

export interface SE3 {
  /** [x, y, z] in metres, Z-up world frame */
  translation: [number, number, number];
  /** Row-major 3×3 rotation matrix */
  rotation: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
}

export interface BasePose {
  x: number;
  y: number;
  yaw: number; // radians
}

// ── Targets ─────────────────────────────────────────────────────────────────

export interface TargetPose {
  id: string;
  pose: SE3;
}

// ── API responses ────────────────────────────────────────────────────────────

export interface JointFrame {
  name: string;
  position: [number, number, number];
  rotation: [[number, number, number], [number, number, number], [number, number, number]];
}

export interface FKResponse {
  joints: JointFrame[];
  ee: JointFrame;
}

export interface ReachabilityResult {
  target_id: string;
  reachable: boolean;
  residual: number;
  q_solution: number[] | null;
}

export interface ReachabilityResponse {
  results: ReachabilityResult[];
  base: BasePose;
}

export interface OptimizeResponse {
  base: BasePose;
  results: ReachabilityResult[];
  total_targets: number;
  reachable_count: number;
  reachable_fraction: number;
  score: number;
  method: string;
}

export interface RobotInfo {
  name: string;
  n_joints: number;
  joint_names: string[];
  joint_lower_limits: number[];
  joint_upper_limits: number[];
  ee_frame_name: string;
  neutral_config: number[];
}

// ── App state ────────────────────────────────────────────────────────────────

export type ReachabilityMap = Record<string, boolean>;

export interface AppState {
  targets: TargetPose[];
  basePose: BasePose;
  fkData: FKResponse | null;
  robotInfo: RobotInfo | null;
  reachabilityMap: ReachabilityMap;
  optimizationResult: OptimizeResponse | null;
  isOptimizing: boolean;
  isCheckingReachability: boolean;
  backendError: string | null;
}
