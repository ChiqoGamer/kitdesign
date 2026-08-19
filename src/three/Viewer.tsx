"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { DesignState, ZoneId } from "@core/index";
import { Jersey } from "./Jersey";

export type ViewName = "front" | "back" | "left" | "right";

export const VIEW_LABELS: Record<ViewName, string> = {
  front: "Frente",
  back: "Espalda",
  left: "Izquierda",
  right: "Derecha",
};

const AZIMUTH: Record<ViewName, number> = {
  front: 0,
  right: Math.PI / 2,
  back: Math.PI,
  left: -Math.PI / 2,
};

const RADIUS = 1.86;
const ELEVATION = 0.1;

function positionFor(view: ViewName): THREE.Vector3 {
  const az = AZIMUTH[view];
  return new THREE.Vector3(
    RADIUS * Math.sin(az) * Math.cos(ELEVATION),
    RADIUS * Math.sin(ELEVATION),
    RADIUS * Math.cos(az) * Math.cos(ELEVATION),
  );
}

/** Interpola la cámara hacia la vista pedida en vez de saltar. */
function ViewController({ view, nonce }: { view: ViewName; nonce: number }) {
  const controls = useThree((s) => s.controls) as { update?: () => void } | null;
  const target = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    target.current = positionFor(view);
  }, [view, nonce]);

  useFrame((state, delta) => {
    const goal = target.current;
    if (!goal) return;
    state.camera.position.lerp(goal, 1 - Math.pow(0.0015, delta));
    state.camera.lookAt(0, 0, 0);
    controls?.update?.();
    if (state.camera.position.distanceTo(goal) < 0.004) target.current = null;
  });

  return null;
}

/**
 * Entorno de iluminación construido con Lightformers en vez de un HDRI
 * descargado: se genera localmente, así que el editor no depende de una
 * CDN externa ni tiene un salto visual al cargar.
 */
function Studio() {
  return (
    <Environment resolution={256}>
      <Lightformer intensity={1.5} position={[0, 1.6, 2.4]} scale={[5, 4, 1]} />
      <Lightformer intensity={0.55} position={[-2.4, 0.8, 1.2]} scale={[3, 4, 1]} />
      <Lightformer intensity={0.45} position={[2.4, 0.6, 0.4]} scale={[3, 4, 1]} />
      <Lightformer
        intensity={0.7}
        position={[0, 0.4, -2.6]}
        scale={[5, 3, 1]}
        color="#cfe0ff"
      />
      <Lightformer
        form="ring"
        intensity={0.7}
        position={[0, 3, 0]}
        rotation-x={Math.PI / 2}
        scale={4}
      />
    </Environment>
  );
}

interface Props {
  design: DesignState;
  revision: number;
  view: ViewName;
  viewNonce: number;
  onPickZone: (zone: ZoneId) => void;
  onHoverZone: (zone: ZoneId | null) => void;
}

export function Viewer({
  design,
  revision,
  view,
  viewNonce,
  onPickZone,
  onHoverZone,
}: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.19, RADIUS], fov: 30 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        // Exposición < 1: con ACES y un entorno de estudio, el default quema
        // los colores saturados y un azul de club sale celeste.
        gl.toneMappingExposure = 0.92;
      }}
    >
      <color attach="background" args={["#0B0D10"]} />
      <hemisphereLight intensity={0.22} groundColor="#0B0D10" />
      <directionalLight
        position={[1.6, 2.4, 2.2]}
        intensity={0.85}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={6}
        shadow-camera-left={-1}
        shadow-camera-right={1}
        shadow-camera-top={1}
        shadow-camera-bottom={-1}
      />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>

      <Jersey
        design={design}
        revision={revision}
        onPickZone={onPickZone}
        onHoverZone={onHoverZone}
      />

      <ContactShadows
        position={[0, -0.4, 0]}
        opacity={0.5}
        scale={2.2}
        blur={2.6}
        far={1.2}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={0.75}
        maxDistance={2.4}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.82}
        enableDamping
        dampingFactor={0.08}
      />
      <ViewController view={view} nonce={viewNonce} />
    </Canvas>
  );
}
