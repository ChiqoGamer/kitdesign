"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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
import { registerViewerCanvas } from "./capture";

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

/**
 * Fracción del alto (o del ancho) visible que debe ocupar la prenda.
 *
 * El encuadre no usa radios fijos por prenda: se mide la caja de las mallas
 * visibles y se calcula la distancia. Así las cuatro vistas quedan igual de
 * ajustadas con un solo número, y sobre todo no recorta las mangas en un
 * viewport angosto — el fov es vertical, así que en una columna estrecha el
 * ancho visible se achica y un radio fijo cortaría la prenda.
 *
 * El valor deja aire arriba y abajo a propósito: el visor tiene la fila de
 * prendas encima y la de vistas debajo, y con la prenda al 90% el ruedo
 * quedaba tapado por los botones.
 */
const FILL = 0.78;

const ELEVATION = 0.09;

/**
 * Ángulo polar del modo giratorio.
 *
 * OrbitControls no tiene un flag "sólo azimut", así que se bloquea igualando
 * el mínimo y el máximo. Sale de la misma ELEVATION que usa `directionFor`:
 * si fueran dos números distintos, entrar al modo giratorio daría un salto
 * de cámara al recortar el ángulo.
 */
const LOCKED_POLAR = Math.PI / 2 - ELEVATION;

/** Dirección unitaria desde el centro de la prenda hacia la cámara. */
function directionFor(view: ViewName): THREE.Vector3 {
  const az = AZIMUTH[view];
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(ELEVATION),
    Math.sin(ELEVATION),
    Math.cos(az) * Math.cos(ELEVATION),
  );
}

/**
 * Caja de las prendas visibles y distancia para encuadrarlas.
 *
 * Devuelve null mientras no haya nada que medir: el GLB carga async, así que
 * el primer intento puede caer antes de que exista la malla. Quien llama
 * reintenta en el frame siguiente.
 *
 * Para el ancho se toma el mayor de X y Z porque la prenda se puede girar:
 * encuadrar sólo con X dejaría la vista lateral corta.
 */
function frameVisible(
  scene: THREE.Scene,
  fovDeg: number,
  aspect: number,
): { center: THREE.Vector3; distance: number } | null {
  const box = new THREE.Box3();
  let found = false;
  scene.traverse((o) => {
    if (o.visible && o.userData?.garment) {
      box.expandByObject(o);
      found = true;
    }
  });
  if (!found || box.isEmpty()) return null;

  const size = box.getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(fovDeg) / 2;
  const forHeight = size.y / 2 / Math.tan(halfFov);
  const forWidth = Math.max(size.x, size.z) / 2 / (Math.tan(halfFov) * aspect);
  return {
    center: box.getCenter(new THREE.Vector3()),
    distance: Math.max(forHeight, forWidth) / FILL,
  };
}

/** Interpola cámara y target hacia la vista/foco pedidos en vez de saltar. */
function ViewController({
  view,
  focus,
  nonce,
  freeOrbit,
}: {
  view: ViewName;
  focus: KitFocus;
  nonce: number;
  freeOrbit?: boolean;
}) {
  const controls = useThree((s) => s.controls) as
    | { target?: THREE.Vector3; update?: () => void }
    | null;
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(
    null,
  );
  /** Hay que recalcular el encuadre en el próximo frame. */
  const pending = useRef(true);
  const size = useThree((s) => s.size);

  useEffect(() => {
    pending.current = true;
  }, [view, focus, nonce, size.width, size.height]);

  /**
   * Al volver de órbita libre a giratorio, endereza la cámara.
   *
   * Sin esto OrbitControls recorta el ángulo de golpe en el primer update y
   * se ve un salto. Se conservan el azimut y la distancia actuales y sólo se
   * corrige la inclinación: volver al modo giratorio no debería perder el
   * lado de la prenda que estabas mirando. El pivote es el target actual, así
   * que también deshace el desplazamiento hecho con Shift.
   */
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (freeOrbit) return;
    pending.current = true;
    const target = controls?.target?.clone() ?? new THREE.Vector3();
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(target),
    );
    spherical.phi = LOCKED_POLAR;
    goal.current = {
      pos: new THREE.Vector3().setFromSpherical(spherical).add(target),
      target,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freeOrbit]);

  useFrame((state, delta) => {
    if (pending.current) {
      const framed = frameVisible(
        state.scene,
        (state.camera as THREE.PerspectiveCamera).fov,
        state.size.width / Math.max(1, state.size.height),
      );
      if (framed) {
        pending.current = false;
        goal.current = {
          pos: framed.center
            .clone()
            .add(directionFor(view).multiplyScalar(framed.distance)),
          target: framed.center,
        };
      }
    }

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


/**
 * Shift mantenido, sólo para mostrar el cursor de desplazar.
 *
 * El gesto lo maneja OrbitControls por su cuenta; esto es la pista visual de
 * que Shift cambió lo que va a hacer el arrastre. Se escucha en window y no
 * en el canvas porque el foco puede estar en un panel del editor cuando el
 * usuario aprieta la tecla.
 *
 * El listener de blur es necesario: si se suelta Shift con la ventana ya sin
 * foco no llega el keyup y el cursor queda mostrando desplazamiento.
 */
function useShiftHeld(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  // Los listeners van siempre montados y el modo se aplica al devolver el
  // valor. Apagarlos según `active` obligaba a resetear el estado dentro del
  // efecto, y además dejaba un valor rancio: si se sale del modo libre con
  // Shift apretado, al volver seguiría creyendo que está apretado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => setHeld(e.shiftKey);
    const blur = () => setHeld(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return active && held;
}

interface Props {
  design: DesignState;
  revision: number;
  view: ViewName;
  viewNonce: number;
  focus: KitFocus;
  /**
   * Órbita libre. Por defecto el visor gira sólo en horizontal y la prenda
   * queda centrada, que es lo que se quiere para mirar un diseño; la órbita
   * libre deja además inclinar la cámara, útil para revisar hombros y cuello.
   */
  freeOrbit?: boolean;
  onPickZone: (zone: ZoneId) => void;
}

export function Viewer({
  design,
  revision,
  freeOrbit,
  view,
  viewNonce,
  focus,
  onPickZone,
}: Props) {
  const panning = useShiftHeld(!!freeOrbit);

  return (
    <Canvas
      shadows
      style={panning ? { cursor: "move" } : undefined}
      dpr={[1, 2]}
      camera={{ position: [0, 0.05, 3.3], fov: 30 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        // Necesario para poder exportar el visor como PNG.
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        registerViewerCanvas(gl.domElement);
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
        design={design}
        revision={revision}
        focus={focus}
        onPickZone={onPickZone}
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
        /**
         * Desplazar y hacer zoom al cursor sólo en movimiento libre. En giro
         * horizontal los dos romperían lo único que ese modo garantiza, que
         * es que la prenda quede centrada.
         */
        enablePan={!!freeOrbit}
        zoomToCursor={!!freeOrbit}
        /**
         * Shift+arrastrar desplaza y no hace falta mapearlo: con
         * mouseButtons.LEFT en ROTATE, OrbitControls ya deriva a pan cuando
         * hay ctrl, meta o shift. Reasignar LEFT a PAN mientras Shift está
         * apretado lo INVIERTE — el caso MOUSE.PAN con shift hace rotate —
         * y el gesto termina girando la cámara.
         */
        minDistance={0.3}
        maxDistance={6}
        minPolarAngle={freeOrbit ? Math.PI * 0.15 : LOCKED_POLAR}
        maxPolarAngle={freeOrbit ? Math.PI * 0.85 : LOCKED_POLAR}
        enableDamping
        dampingFactor={0.08}
      />
      <ViewController
        view={view}
        focus={focus}
        nonce={viewNonce}
        freeOrbit={freeOrbit}
      />
    </Canvas>
  );
}
