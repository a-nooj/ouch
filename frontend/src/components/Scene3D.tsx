/**
 * Scene3D — the main react-three-fiber canvas.
 *
 * Coordinate system: Z-up throughout.
 *
 * Warm palette:
 *   Background: #1C1510  — dark peat / rich soil
 *   Ambient:    #FFF3DC  — warm candlelight
 *   Sun:        #FFE4A0  — golden-hour directional
 *   Fill:       #FF9D5C  — warm amber point light
 *   Fog:        matches background for depth fade
 */

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";

import { useStore } from "../store/useStore";
import { GroundPlane } from "./GroundPlane";
import { RobotVisual } from "./RobotVisual";
import { TargetPose } from "./TargetPose";
import { BasePoseVisual } from "./BasePoseVisual";

// Set Z as the global "up" axis
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const SCENE_BG = "#1C1510"; // dark peat

export function Scene3D() {
  const targets        = useStore((s) => s.targets);
  const reachabilityMap= useStore((s) => s.reachabilityMap);
  const fkData         = useStore((s) => s.fkData);
  const basePose       = useStore((s) => s.basePose);
  const addTarget      = useStore((s) => s.addTarget);
  const removeTarget   = useStore((s) => s.removeTarget);

  return (
    <Canvas
      shadows
      gl={{ antialias: true }}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl, scene }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Warm dark background — rich soil / peat
        scene.background = new THREE.Color(SCENE_BG);
        // Exponential fog fades geometry into the warm dark background
        scene.fog = new THREE.FogExp2(SCENE_BG, 0.038);
      }}
    >
      {/* Camera — above and to the side, looking toward origin */}
      <PerspectiveCamera
        makeDefault
        fov={50}
        near={0.01}
        far={100}
        position={[3, -4, 3]}
        up={[0, 0, 1]}
      />

      <OrbitControls
        target={[0, 0, 0.5]}
        minDistance={0.5}
        maxDistance={20}
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />

      {/* ── Warm golden-hour lighting ── */}

      {/* Candlelight ambient — lifts shadows without flattening */}
      <ambientLight color="#FFF3DC" intensity={0.42} />

      {/* Main sun — warm golden directional from high front-right */}
      <directionalLight
        position={[5, -5, 8]}
        color="#FFE4A0"
        intensity={1.15}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />

      {/* Warm amber fill — softens the shadow side */}
      <pointLight position={[-3, 3, 4]} color="#FF9D5C" intensity={0.32} />

      {/* ── Ground ── */}
      <GroundPlane onAddTarget={addTarget} />

      {/*
        Grid overlay in the XY plane (Z-up ground).
        Rotated −90° around X from drei's default (Y-up XZ plane).
        Warm brown cell/section colours to match the earthy scene.
      */}
      <Grid
        position={[0, 0, 0.001]}
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#4A3B2A"
        sectionSize={2}
        sectionThickness={0.9}
        sectionColor="#705A3E"
        fadeDistance={16}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid={false}
        rotation={[-Math.PI / 2, 0, 0]}
      />

      {/* ── Scene objects ── */}
      <BasePoseVisual base={basePose} />

      {fkData && <RobotVisual fkData={fkData} />}

      {targets.map((target) => (
        <TargetPose
          key={target.id}
          target={target}
          reachable={reachabilityMap[target.id]}
          onRemove={removeTarget}
        />
      ))}
    </Canvas>
  );
}
