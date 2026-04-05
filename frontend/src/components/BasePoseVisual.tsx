/**
 * BasePoseVisual — robot base frame rendered as a moss-green disc + RGB axes.
 *
 * The disc uses the design-system primary (moss green #5D7052) so it reads
 * as "home base" against the dark earthy ground. Axes retain RGB convention
 * but are softened slightly toward the warm palette.
 */

import { useMemo } from "react";
import * as THREE from "three";
import type { BasePose } from "../types";

const DISC_RADIUS = 0.18;
const AXIS_LEN    = 0.25;
const AXIS_HEAD   = 0.06;
const AXIS_SHAFT  = 0.010;

// Softened axis colours — still RGB but earthier
const X_COLOR = 0xd45c4a; // terracotta red
const Y_COLOR = 0x5a9e52; // leaf green
const Z_COLOR = 0x4a7ab5; // dusty blue

interface Props { base: BasePose }

function Axis({
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
        AXIS_LEN,
        color,
        AXIS_HEAD,
        AXIS_SHAFT,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, color],
  );
  return <primitive object={arrow} />;
}

export function BasePoseVisual({ base }: Props) {
  const { x, y, yaw } = base;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);

  const xDir  = useMemo(() => new THREE.Vector3(c, s, 0),   [c, s]);
  const yDir  = useMemo(() => new THREE.Vector3(-s, c, 0),  [c, s]);
  const zDir  = useMemo(() => new THREE.Vector3(0, 0, 1),   []);
  const origin= useMemo(() => new THREE.Vector3(x, y, 0.001), [x, y]);

  return (
    <group>
      {/* Moss-green base disc */}
      <mesh position={[x, y, 0.001]} rotation={[0, 0, yaw]}>
        <circleGeometry args={[DISC_RADIUS, 40]} />
        <meshStandardMaterial
          color="#5D7052"
          transparent
          opacity={0.42}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Outer ring for definition */}
      <mesh position={[x, y, 0.001]} rotation={[0, 0, yaw]}>
        <ringGeometry args={[DISC_RADIUS - 0.012, DISC_RADIUS, 40]} />
        <meshStandardMaterial
          color="#5D7052"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Axis origin={origin} direction={xDir} color={X_COLOR} />
      <Axis origin={origin} direction={yDir} color={Y_COLOR} />
      <Axis origin={origin} direction={zDir} color={Z_COLOR} />
    </group>
  );
}
