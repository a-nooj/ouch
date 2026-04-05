/**
 * GroundPlane — invisible mesh capturing left-clicks to place targets.
 *
 * Material: dark rich soil colour (#211608) so the warm grid lines read
 * crisply on top. Slight roughness prevents specular hotspots.
 */

import { useRef } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";

const PLANE_SIZE = 20;

interface Props {
  onAddTarget: (x: number, y: number, z: number) => void;
}

export function GroundPlane({ onAddTarget }: Props) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const pt = event.point;
    onAddTarget(pt.x, pt.y, pt.z);
  };

  return (
    <mesh ref={meshRef} onClick={handleClick} receiveShadow>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      <meshStandardMaterial
        color="#211608"
        roughness={0.95}
        metalness={0.0}
        transparent
        opacity={0.82}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
