/**
 * TargetPose — floating Panda gripper (hand.dae + finger.dae) at each target.
 *
 * Transforms in panda_hand_tcp frame (Z = approach direction):
 *   hand mesh      → z = -0.1034  (hand_tcp_joint: xyz="0 0 0.1034")
 *   finger origins → z = -0.0450  (finger_joint: xyz="0 0 0.0584" from hand)
 *   left  finger   → +Y, rotation identity
 *   right finger   → -Y, rotation z=π  (visual origin rpy="0 0 π" in URDF)
 *
 * Meshes are loaded once (module-level cache) and cloned per target instance.
 * Material is overridden with the reachability colour.
 */

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { TargetPose as TargetPoseType } from "../types";
import { frameAxes, rotationMatrixToQuaternion } from "../utils/poses";

// ── Mesh URLs ─────────────────────────────────────────────────────────────────
const MESH_BASE =
  "/api/robot/meshes/example-robot-data/robots/panda_description/meshes/visual";

// ── URDF-derived transforms (TCP frame) ───────────────────────────────────────
const HAND_Z   = -0.1034;  // hand origin is 103.4 mm behind TCP
const FINGER_Z = -0.0450;  // 0.0584 (from hand) − 0.1034 = −0.045
const FINGER_Y =  0.010;   // half-open (10 mm each side)

// ── Module-level mesh template cache ─────────────────────────────────────────
let handTpl: THREE.Object3D | null = null;
let fingerTpl: THREE.Object3D | null = null;
let loadPromise: Promise<void> | null = null;

function loadTemplates(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<void>((resolve, reject) => {
    let remaining = 2;
    const check = () => { if (--remaining === 0) resolve(); };
    new ColladaLoader().load(
      `${MESH_BASE}/hand.dae`,
      (r) => { handTpl = r.scene; check(); },
      undefined,
      reject,
    );
    new ColladaLoader().load(
      `${MESH_BASE}/finger.dae`,
      (r) => { fingerTpl = r.scene; check(); },
      undefined,
      reject,
    );
  });
  return loadPromise;
}

function applyColor(obj: THREE.Object3D, hex: string): void {
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.45,
    metalness: 0.20,
    emissive: hex,
    emissiveIntensity: 0.07,
  });
  obj.traverse((c) => { if (c instanceof THREE.Mesh) c.material = mat; });
}

// ── Visual constants ──────────────────────────────────────────────────────────
const ARROW_LENGTH = 0.12;
const ARROW_HEAD   = 0.032;
const ARROW_SHAFT  = 0.007;
const X_COLOR = 0xd45c4a;
const Y_COLOR = 0x5a9e52;
const Z_COLOR = 0x4a7ab5;
const COLOR_REACHABLE   = "#5A8C4E";
const COLOR_UNREACHABLE = "#B85848";
const COLOR_UNKNOWN     = "#8C8880";

interface Props {
  target: TargetPoseType;
  reachable: boolean | undefined;
  onRemove: (id: string) => void;
}

function Arrow({ direction, color }: { direction: THREE.Vector3; color: number }) {
  const arrow = useMemo(
    () =>
      new THREE.ArrowHelper(
        direction.clone().normalize(),
        new THREE.Vector3(),
        ARROW_LENGTH, color, ARROW_HEAD, ARROW_SHAFT,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction.x, direction.y, direction.z, color],
  );
  return <primitive object={arrow} />;
}

export function TargetPose({ target, reachable, onRemove }: Props) {
  const [tx, ty, tz] = target.pose.translation;
  const { xAxis, yAxis, zAxis } = frameAxes(target.pose.rotation);
  const quaternion = useMemo(
    () => rotationMatrixToQuaternion(target.pose.rotation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target.pose.rotation],
  );

  const [gripper, setGripper] = useState<THREE.Group | null>(null);

  // Load hand + finger templates once; clone for this instance
  useEffect(() => {
    let active = true;
    loadTemplates()
      .then(() => {
        if (!active || !handTpl || !fingerTpl) return;

        const hand = handTpl.clone(true);
        hand.position.set(0, 0, HAND_Z);

        const lf = fingerTpl.clone(true);
        lf.position.set(0, FINGER_Y, FINGER_Z);

        const rf = fingerTpl.clone(true);
        rf.position.set(0, -FINGER_Y, FINGER_Z);
        rf.rotation.z = Math.PI;  // URDF: visual origin rpy="0 0 π"

        const g = new THREE.Group();
        g.add(hand, lf, rf);
        setGripper(g);
      })
      .catch((e) => console.error("Gripper mesh load failed:", e));
    return () => { active = false; };
  }, []);

  const color =
    reachable === undefined ? COLOR_UNKNOWN
    : reachable             ? COLOR_REACHABLE
    :                         COLOR_UNREACHABLE;

  useEffect(() => {
    if (gripper) applyColor(gripper, color);
  }, [gripper, color]);

  const onCtx   = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onRemove(target.id); };
  const onClick = (e: ThreeEvent<MouseEvent>) => e.stopPropagation();

  const tooltipLabel  = reachable === undefined ? "Checking…" : reachable ? "Reachable" : "Unreachable";
  const tooltipAccent = reachable === undefined ? "#8C8880"   : reachable ? "#5A8C4E"   : "#B85848";

  return (
    <group position={[tx, ty, tz]}>
      {/* ── Gripper meshes, oriented by target rotation ── */}
      {gripper && (
        <group quaternion={quaternion}>
          <primitive object={gripper} />
          {/* Transparent hit-box — lets right-click reach the handler */}
          <mesh onContextMenu={onCtx} onClick={onClick}>
            <boxGeometry args={[0.10, 0.10, 0.14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* ── Frame axes ── */}
      <Arrow direction={xAxis} color={X_COLOR} />
      <Arrow direction={yAxis} color={Y_COLOR} />
      <Arrow direction={zAxis} color={Z_COLOR} />

      {/* ── Tooltip ── */}
      <Html position={[0, 0, 0.06]} style={{ pointerEvents: "none" }}>
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
