/**
 * Pose utilities.
 *
 * Coordinate convention: Z-up throughout.
 *   - ground plane is z = 0 (XY plane)
 *   - robot base is at z = 0
 *   - target poses are above the ground (z > 0)
 */

import * as THREE from "three";
import type { SE3 } from "../types";

/** Default height above ground for newly placed target poses. */
export const DEFAULT_TARGET_HEIGHT = 0.5; // metres

/**
 * Default gripper orientation: approach from above (gripper Z points down).
 *
 * In Z-up world: gripper's z-axis = [0, 0, -1]
 *   → R = 180° rotation about X = diag(1, -1, -1)
 */
const DEFAULT_ROTATION: SE3["rotation"] = [
  [1,  0,  0],
  [0, -1,  0],
  [0,  0, -1],
];

/**
 * Build a default SE3 target pose at the given world-space position (Z-up).
 * The orientation is "gripper pointing straight down".
 */
export function makeDefaultTargetPose(
  x: number,
  y: number,
  z: number,
): SE3 {
  return {
    translation: [x, y, z + DEFAULT_TARGET_HEIGHT],
    rotation: DEFAULT_ROTATION,
  };
}

/**
 * Convert a SE3 rotation matrix (row-major 3×3) into a THREE.Quaternion.
 *
 * The rotation matrix is given in Z-up world coordinates.
 * Three.js also operates in Z-up here (we set THREE.Object3D.DEFAULT_UP = Z).
 */
export function rotationMatrixToQuaternion(
  R: SE3["rotation"],
): THREE.Quaternion {
  const m = new THREE.Matrix4();
  // THREE.Matrix4 is column-major; R is row-major
  m.set(
    R[0][0], R[0][1], R[0][2], 0,
    R[1][0], R[1][1], R[1][2], 0,
    R[2][0], R[2][1], R[2][2], 0,
    0,       0,       0,       1,
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/**
 * Extract the three column vectors from a rotation matrix as THREE.Vector3s.
 * Columns represent the X, Y, Z axes of the frame, expressed in world space.
 */
export function frameAxes(R: SE3["rotation"]): {
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
} {
  return {
    xAxis: new THREE.Vector3(R[0][0], R[1][0], R[2][0]),
    yAxis: new THREE.Vector3(R[0][1], R[1][1], R[2][1]),
    zAxis: new THREE.Vector3(R[0][2], R[1][2], R[2][2]),
  };
}
