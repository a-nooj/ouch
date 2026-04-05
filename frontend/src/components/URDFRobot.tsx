/**
 * URDFRobot — loads and renders the actual URDF mesh geometry.
 *
 * Uses urdf-loader to fetch the URDF from the backend, resolve
 * package:// mesh URLs via /api/robot/meshes/, and build a three.js
 * scene graph with Collada (.dae) visual meshes.
 *
 * Joint values are set from robotInfo.neutral_config by name.
 * The base transform (x, y, yaw) is applied to the wrapping group.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import URDFLoader from "urdf-loader";
import type { URDFRobot as URDFRobotModel } from "urdf-loader";
import type { BasePose, RobotInfo } from "../types";

interface Props {
  basePose: BasePose;
  robotInfo: RobotInfo;
}

export function URDFRobot({ basePose, robotInfo }: Props) {
  const [robot, setRobot] = useState<URDFRobotModel | null>(null);
  const groupRef = useRef<THREE.Group>(null!);

  // Load URDF once on mount
  useEffect(() => {
    const loader = new URDFLoader();
    loader.packages = (pkg: string) => `/api/robot/meshes/${pkg}`;
    loader.load(
      "/api/robot/urdf",
      (result) => setRobot(result),
      undefined,
      (err) => console.error("Failed to load URDF:", err),
    );
  }, []);

  // Set joint angles from neutral config
  useEffect(() => {
    if (!robot) return;
    robotInfo.joint_names.forEach((name, i) => {
      robot.setJointValue(name, robotInfo.neutral_config[i]);
    });
  }, [robot, robotInfo.joint_names, robotInfo.neutral_config]);

  // Apply planar base transform (x, y, yaw about Z)
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(basePose.x, basePose.y, 0);
    g.rotation.set(0, 0, basePose.yaw);
  }, [basePose.x, basePose.y, basePose.yaw]);

  if (!robot) return null;

  return (
    <group ref={groupRef}>
      <primitive object={robot} />
    </group>
  );
}
