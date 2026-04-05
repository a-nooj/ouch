/**
 * TargetPose — 3D target marker with earthy reachability colours.
 *
 * Reachability palette (organic):
 *   Reachable:   #5A8C4E  leaf green (brighter sibling of moss #5D7052)
 *   Unreachable: #B85848  warm clay red (brighter sibling of sienna #A85448)
 *   Unknown:     #8C8880  warm stone grey
 *
 * Tooltip uses the warm dark foreground + sand text to match the sidebar.
 */

import { useRef } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { TargetPose as TargetPoseType } from "../types";
import { frameAxes } from "../utils/poses";

const SPHERE_RADIUS = 0.04;
const ARROW_LENGTH  = 0.15;
const ARROW_HEAD    = 0.04;
const ARROW_SHAFT   = 0.008;

// Softened axis colours matching the rest of the scene
const X_COLOR = 0xd45c4a;
const Y_COLOR = 0x5a9e52;
const Z_COLOR = 0x4a7ab5;

// Earthy reachability colours
const COLOR_REACHABLE   = "#5A8C4E";
const COLOR_UNREACHABLE = "#B85848";
const COLOR_UNKNOWN     = "#8C8880";

interface Props {
  target: TargetPoseType;
  reachable: boolean | undefined;
  onRemove: (id: string) => void;
}

function Arrow({
  origin,
  direction,
  color,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  color: number;
}) {
  const arrow = new THREE.ArrowHelper(
    direction.clone().normalize(),
    origin,
    ARROW_LENGTH,
    color,
    ARROW_HEAD,
    ARROW_SHAFT,
  );
  return <primitive object={arrow} />;
}

export function TargetPose({ target, reachable, onRemove }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [tx, ty, tz] = target.pose.translation;
  const origin = new THREE.Vector3(tx, ty, tz);
  const { xAxis, yAxis, zAxis } = frameAxes(target.pose.rotation);

  const sphereColor =
    reachable === undefined ? COLOR_UNKNOWN
    : reachable             ? COLOR_REACHABLE
    :                         COLOR_UNREACHABLE;

  const tooltipLabel =
    reachable === undefined ? "Checking…"
    : reachable             ? "Reachable"
    :                         "Unreachable";

  const tooltipAccent =
    reachable === undefined ? "#8C8880"
    : reachable             ? "#5A8C4E"
    :                         "#B85848";

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onRemove(target.id);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
  };

  return (
    <group position={[tx, ty, tz]}>
      {/* Reachability sphere */}
      <mesh
        ref={meshRef}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        castShadow
      >
        <sphereGeometry args={[SPHERE_RADIUS, 18, 18]} />
        <meshStandardMaterial
          color={sphereColor}
          roughness={0.35}
          metalness={0.12}
          emissive={sphereColor}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Frame axes */}
      <Arrow origin={new THREE.Vector3(0, 0, 0)} direction={xAxis} color={X_COLOR} />
      <Arrow origin={new THREE.Vector3(0, 0, 0)} direction={yAxis} color={Y_COLOR} />
      <Arrow origin={new THREE.Vector3(0, 0, 0)} direction={zAxis} color={Z_COLOR} />

      {/* Warm tooltip */}
      <Html
        position={[0, 0, SPHERE_RADIUS + 0.06]}
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: "rgba(44, 44, 36, 0.92)",
            backdropFilter: "blur(8px)",
            color: "#E6DCCD",
            fontSize: 10,
            fontFamily: "Nunito, system-ui, sans-serif",
            fontWeight: 600,
            padding: "3px 10px 4px",
            borderRadius: 12,
            whiteSpace: "nowrap",
            border: "1px solid rgba(230, 220, 205, 0.12)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <span style={{ color: tooltipAccent }}>{tooltipLabel}</span>
          <span
            style={{
              display: "block",
              color: "rgba(230,220,205,0.5)",
              fontSize: 9,
              marginTop: 1,
            }}
          >
            Right-click to remove
          </span>
        </div>
      </Html>
    </group>
  );
}
