"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import type { DesignState, ZoneId } from "@core/index";
import { Kit, type KitFocus } from "./Kit";

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

/** Encuadre por prenda: a qué altura mirar y desde qué distancia. */
const FRAMING: Record<KitFocus, { targetY: number; radius: number }> = {
  all: { targetY: 0.02, radius: 3.55 },
  jersey: { targetY: 0.44, radius: 2.05 },
  shorts: { targetY: -0.02, radius: 1.4 },
  socks: { targetY: -0.6, radius: 1.45 },
};

const ELEVATION = 0.09;

function positionFor(view: ViewName, focus: KitFocus): THREE.Vector3 {
  const az = AZIMUTH[view];
  const { targetY, radius } = FRAMING[focus];
  return new THREE.Vector3(
    radius * Math.sin(az) * Math.cos(ELEVATION),
    targetY + radius * Math.sin(ELEVATION),
    radius * Math.cos(az) * Math.cos(ELEVATION),
  );
}

/** Interpola cámara y target hacia la vista/foco pedidos en vez de saltar. */
function ViewController({
  view,
  focus,
  nonce,
}: {
  view: ViewName;
  focus: KitFocus;
  nonce: number;
}) {
  const controls = useThree((s) => s.controls) as
    | { target?: THREE.Vector3; update?: () => void }
    | null;
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null,
  );

  useEffect(() => {
    goal.current = {
      pos: positionFor(view, focus),
      target: new THREE.Vector3(0, FRAMING[focus].targetY, 0),
    };
  }, [view, focus, nonce]);

  useFrame((state, delta) => {
    const g = goal.current;
    if (!g) return;
    const k = 1 - Math.pow(0.0015, delta);
    state.camera.position.lerp(g.pos, k);
    if (controls?.target) {
      controls.target.lerp(g.target, k);
      controls.update?.();
    } else {
      state.camera.lookAt(g.target);
    }
    if (state.camera.position.distanceTo(g.pos) < 0.004) goal.current = null;
  });

  return null;
}

/**
 * Entorno de iluminación construido con Lightformers en vez de un HDRI
 * descargado: se genera localmente, así que el editor no depende de una
 * CDN externa ni tiene un salto visual al cargar.
 *
 * OJO: <Environment> suspende — sin el <Suspense> propio del caller,
 * ningún hijo del <Canvas> monta y la escena queda negra sin error.
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
  focus: KitFocus;
  /** Usar la malla de referencia (GLB) en vez de la procedural. */
  refMesh?: boolean;
  onPickZone: (zone: ZoneId) => void;
  onHoverZone: (zone: ZoneId | null) => void;
}

export function Viewer({
  design,
  revision,
  refMesh,
  view,
  viewNonce,
  focus,
  onPickZone,
  onHoverZone,
}: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.05, 3.3], fov: 30 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        // Exposición < 1: con ACES y un entorno de estudio, el default quema
        // los colores saturados y un azul de club sale celeste.
        gl.toneMappingExposure = 0.92;
      }}
    >
      <color attach="background" args={["#0B0D10"]} />
      <hemisphereLight intensity={0.22} groundColor="#0B0D10" />
      {/* Luz de recorte trasera: separa la silueta del fondo, como en un
          render de producto. */}
      <directionalLight position={[-1.8, 1.6, -2.4]} intensity={0.5} color="#cfe0ff" />
      <directionalLight
        position={[1.6, 2.4, 2.2]}
        intensity={0.85}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={6}
        shadow-camera-left={-1.4}
        shadow-camera-right={1.4}
        shadow-camera-top={1.4}
        shadow-camera-bottom={-1.4}
      />
      <Suspense fallback={null}>
        <Studio />
      </Suspense>

      <Kit
        refMesh={refMesh}
        design={design}
        revision={revision}
        focus={focus}
        onPickZone={onPickZone}
        onHoverZone={onHoverZone}
      />

      <ContactShadows
        position={[0, -1.42, 0]}
        opacity={0.55}
        scale={3}
        blur={2.4}
        far={1.4}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={0.7}
        maxDistance={3.6}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.85}
        enableDamping
        dampingFactor={0.08}
      />
      <ViewController view={view} focus={focus} nonce={viewNonce} />
    </Canvas>
  );
}
