/**
 * RobotVisual — stick-figure Panda rendered in warm walnut tones.
 *
 * Colour palette:
 *   Links / joints: #9B8570 — warm walnut / light wood
 *   Base joint:     #6B5240 — dark mahogany
 *   EE sphere:      #D4A96A — warm gold / brass
 *   EE axes:        softened terracotta/leaf/dusty-blue (matches BasePoseVisual)
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { FKResponse, JointFrame } from "../types";
import { frameAxes } from "../utils/poses";

const JOINT_RADIUS  = 0.025;
const LINK_RADIUS   = 0.015;
const EE_AXIS_LEN   = 0.12;
const EE_AXIS_HEAD  = 0.03;
const EE_AXIS_SHAFT = 0.006;

const ROBOT_COLOR = 0x9B8570; // warm walnut
const BASE_COLOR  = 0x6B5240; // dark mahogany
const EE_COLOR    = 0xD4A96A; // warm brass / gold

// Softened axis colours matching BasePoseVisual
const X_COLOR = 0xd45c4a;
const Y_COLOR = 0x5a9e52;
const Z_COLOR = 0x4a7ab5;

interface Props { fkData: FKResponse }

function LinkSegment({
  from,
  to,
  radius = LINK_RADIUS,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius?: number;
}) {
  const { position, quaternion, height } = useMemo(() => {
    const dir = to.clone().sub(from);
    const h   = dir.length();
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const q   = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { position: mid, quaternion: q, height: h };
  }, [from, to]);

  if (height < 0.001) return null;

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, height, 10]} />
      <meshStandardMaterial
        color={ROBOT_COLOR}
        roughness={0.65}
        metalness={0.2}
      />
    </mesh>
  );
}

function EEAxis({
  origin,
  direction,
  color,
}: {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  color: number;
}) {
  const arrow = useMemo(
    () =>
      new THREE.ArrowHelper(
        direction.normalize(),
        origin,
        EE_AXIS_LEN,
        color,
        EE_AXIS_HEAD,
        EE_AXIS_SHAFT,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, color],
  );
  return <primitive object={arrow} />;
}

export function RobotVisual({ fkData }: Props) {
  const { joints, ee } = fkData;

  const positions: THREE.Vector3[] = useMemo(
    () => joints.map((j) => new THREE.Vector3(...j.position)),
    [joints],
  );

  const eePos = useMemo(() => new THREE.Vector3(...ee.position), [ee]);
  const { xAxis, yAxis, zAxis } = useMemo(() => frameAxes(ee.rotation), [ee]);

  return (
    <group>
      {/* Joint spheres */}
      {joints.map((joint: JointFrame, i: number) => (
        <mesh key={joint.name} position={positions[i]} castShadow>
          <sphereGeometry args={[i === 0 ? JOINT_RADIUS * 1.8 : JOINT_RADIUS, 14, 14]} />
          <meshStandardMaterial
            color={i === 0 ? BASE_COLOR : ROBOT_COLOR}
            roughness={0.5}
            metalness={0.25}
          />
        </mesh>
      ))}

      {/* Link cylinders */}
      {positions.slice(1).map((pos, i) => (
        <LinkSegment key={`link-${i}`} from={positions[i]} to={pos} />
      ))}

      {/* Last joint to EE */}
      {positions.length > 0 && (
        <LinkSegment
          from={positions[positions.length - 1]}
          to={eePos}
          radius={LINK_RADIUS * 0.8}
        />
      )}

      {/* EE coordinate frame */}
      <EEAxis origin={eePos} direction={xAxis} color={X_COLOR} />
      <EEAxis origin={eePos} direction={yAxis} color={Y_COLOR} />
      <EEAxis origin={eePos} direction={zAxis} color={Z_COLOR} />

      {/* EE brass sphere */}
      <mesh position={eePos} castShadow>
        <sphereGeometry args={[JOINT_RADIUS * 1.2, 14, 14]} />
        <meshStandardMaterial color={EE_COLOR} roughness={0.25} metalness={0.55} />
      </mesh>
    </group>
  );
}
