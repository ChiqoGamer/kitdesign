"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { DesignState, GarmentId, ZoneId } from "@core/index";
import { ANCHORS } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { useGLTF } from "@react-three/drei";
import { prepareRefGeometry } from "./refJersey";
import { buildShortsGeometry } from "@geom/shorts";
import { buildSocksGeometry } from "@geom/socks";
import { useGarmentTexture } from "./useGarmentTexture";
import { getFabricNormalMap, getFabricRoughnessMap } from "./fabricNormal";
import { UNFOLD_DELAY, addFlatMorph, easeInOut, type UnfoldInfo } from "./unfold";
import { layerAtUv } from "./layerHit";

/**
 * Disposición del kit completo en escena, estilo "equipación flotante":
 * camiseta arriba, short solapado detrás del ruedo, medias abajo con un
 * pequeño espacio — como se presenta un kit en los juegos.
 */
export const KIT_LAYOUT: Record<GarmentId, { y: number; z: number }> = {
  jersey: { y: 0.12, z: 0 },
  shorts: { y: -0.24, z: -0.008 },
  socks: { y: -0.73, z: 0 },
};

/** Altura del grupo del kit; el molde plano se calcula en coordenadas de escena. */
const KIT_Y = 0.02;

/** Duración de desplegar o plegar una prenda, en segundos. */
const UNFOLD_SECONDS = 1.1;

/**
 * Traduce el punto UV de un raycast a la zona editable correspondiente.
 * Gracias a esto el modelo 3D *es* el selector: no hace falta un árbol de
 * capas para elegir "las mangas", se hace click sobre ellas.
 */
function zoneAtUv(
  garment: GarmentId,
  uv: THREE.Vector2 | undefined,
): ZoneId | null {
  if (!uv) return null;
  for (const piece of GARMENT_ATLASES[garment].pieces) {
    const { x, y, w, h } = piece.rect;
    if (uv.x >= x && uv.x <= x + w && uv.y >= y && uv.y <= y + h) {
      return piece.zone;
    }
  }
  return null;
}

/** Qué se puede hacer con las capas desde el visor (sólo en el editor). */
export interface LayerDragHandlers {
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, offset: { x: number; y: number }) => void;
}

interface GarmentMeshProps {
  design: DesignState;
  revision: number;
  garment: GarmentId;
  geometry: THREE.BufferGeometry;
  unfold: UnfoldInfo;
  visible: boolean;
  unfolded: boolean;
  onPickZone?: (zone: ZoneId) => void;
  drag?: LayerDragHandlers;
}

function GarmentMesh({
  design,
  revision,
  garment,
  geometry,
  unfold,
  visible,
  unfolded,
  onPickZone,
  drag,
}: GarmentMeshProps) {
  const texture = useGarmentTexture(design, revision, garment);
  const layout = KIT_LAYOUT[garment];
  const mesh = useRef<THREE.Mesh>(null);
  /**
   * Los controles de cámara y el canvas se leen en el momento del evento,
   * no al renderizar: OrbitControls se registra después del primer render y
   * un listener armado antes se quedaba con `null` para siempre.
   */
  const get = useThree((s) => s.get);
  const setOrbit = (enabled: boolean) => {
    const controls = get().controls as { enabled: boolean } | null;
    if (controls) controls.enabled = enabled;
  };
  const setCursor = (cursor: string) => {
    get().gl.domElement.style.cursor = cursor;
  };

  // R3F asigna la geometría después de crear el mesh, así que la lista de
  // influencias de los morphs hay que armarla a mano.
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.updateMorphTargets();
  }, [geometry]);

  /**
   * Progreso del despliegue, 0 = armada y 1 = molde plano. Avanza con el
   * tiempo y no con un tween de librería: si se aprieta el botón a mitad de
   * camino, vuelve desde donde está sin saltar.
   */
  const progress = useRef(0);
  const clock = useRef(0);
  useEffect(() => {
    clock.current = 0;
  }, [unfolded]);
  useFrame((_, delta) => {
    const m = mesh.current;
    if (!m?.morphTargetInfluences) return;
    clock.current += delta;
    if (clock.current < UNFOLD_DELAY[garment] * (unfolded ? 1 : 0.5)) return;
    const target = unfolded ? 1 : 0;
    const step = delta / UNFOLD_SECONDS;
    progress.current =
      target > progress.current
        ? Math.min(target, progress.current + step)
        : Math.max(target, progress.current - step);
    m.morphTargetInfluences[0] = easeInOut(progress.current);
  });

  /**
   * ARRASTRAR CAPAS
   * El raycast da la UV bajo el cursor, que es el mismo espacio donde viven
   * las capas. Al agarrar se guarda la distancia entre el centro de la capa
   * y el punto tocado, así la capa no salta a centrarse bajo el cursor.
   */
  const dragging = useRef<{ id: string; grab: { x: number; y: number } } | null>(null);
  const moved = useRef(false);

  // Se suelta en window: el cursor puede terminar fuera de la prenda.
  useEffect(() => {
    const endDrag = () => {
      if (!dragging.current) return;
      dragging.current = null;
      const state = get();
      const controls = state.controls as { enabled: boolean } | null;
      if (controls) controls.enabled = true;
      state.gl.domElement.style.cursor = "";
    };
    window.addEventListener("pointerup", endDrag);
    return () => window.removeEventListener("pointerup", endDrag);
  }, [get]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    moved.current = false;
    if (!drag || !e.uv || e.button !== 0) return;
    const hit = layerAtUv(design, garment, e.uv);
    if (!hit) return;
    e.stopPropagation();
    dragging.current = {
      id: hit.layer.id,
      grab: { x: hit.center.x - e.uv.x, y: hit.center.y - e.uv.y },
    };
    // Sin esto el mismo arrastre también giraría la cámara.
    setOrbit(false);
    drag.onSelectLayer(hit.layer.id);
    setCursor("grabbing");
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag || !e.uv) return;
    const d = dragging.current;
    if (!d) {
      // Pista de que se puede agarrar, sólo sobre una capa.
      setCursor(layerAtUv(design, garment, e.uv) ? "grab" : "");
      return;
    }
    e.stopPropagation();
    moved.current = true;
    const layer = design.layers.find((l) => l.id === d.id);
    if (!layer) return;
    const anchor = ANCHORS[layer.anchor].uv;
    drag.onMoveLayer(d.id, {
      x: e.uv.x + d.grab.x - anchor.x,
      y: e.uv.y + d.grab.y - anchor.y,
    });
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    // Soltar después de arrastrar una capa no es elegir una zona.
    if (moved.current || event.delta > 4) return;
    const zone = zoneAtUv(garment, event.uv);
    if (zone) {
      event.stopPropagation();
      onPickZone?.(zone);
    }
  };

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      position={[0, layout.y, layout.z]}
      visible={visible}
      // R3F reasigna userData en cada render: lo que lea el visor (prenda y
      // cajas para encuadrar) tiene que venir acá, no escrito aparte.
      userData={{ garment, unfold }}
      castShadow
      receiveShadow
      onClick={visible ? handleClick : undefined}
      onPointerDown={visible ? handlePointerDown : undefined}
      onPointerMove={visible ? handlePointerMove : undefined}
      onPointerOut={() => {
        if (!dragging.current) setCursor("");
      }}
    >
      <meshPhysicalMaterial
        map={texture}
        vertexColors
        normalMap={getFabricNormalMap()}
        normalScale={new THREE.Vector2(0.22, 0.22)}
        roughnessMap={getFabricRoughnessMap()}
        side={THREE.DoubleSide}
        roughness={0.82}
        metalness={0}
        sheen={0.28}
        sheenRoughness={0.62}
        sheenColor={new THREE.Color("#e8eefc")}
        clearcoat={0.03}
        clearcoatRoughness={0.7}
        envMapIntensity={0.6}
      />
    </mesh>
  );
}

export type KitFocus = GarmentId | "all";

const REF_MODEL_URL = "/models/jersey-ref.glb";

interface Props {
  design: DesignState;
  revision: number;
  focus: KitFocus;
  /** Muestra las prendas abiertas en su molde plano. */
  unfolded?: boolean;
  onPickZone?: (zone: ZoneId) => void;
  /** Si viene, las capas se pueden agarrar y mover sobre el 3D. */
  drag?: LayerDragHandlers;
}

/** Geometría + su molde plano, calculados una sola vez por prenda. */
function withUnfold(
  geometry: THREE.BufferGeometry,
  garment: GarmentId,
): { geometry: THREE.BufferGeometry; unfold: UnfoldInfo } {
  const layout = KIT_LAYOUT[garment];
  const unfold = addFlatMorph(
    geometry,
    garment,
    new THREE.Vector3(0, layout.y + KIT_Y, layout.z),
  );
  return { geometry, unfold };
}

export function Kit({ design, revision, focus, unfolded = false, onPickZone, drag }: Props) {
  /**
   * Camiseta: GLB del editor open source, con sus UVs remapeadas a nuestro
   * atlas. Short y medias siguen siendo procedurales y son fijas; los
   * colores los absorbe la textura, así que no dependen del diseño.
   */
  const { scene: refScene } = useGLTF(REF_MODEL_URL);
  const jersey = useMemo(
    () => withUnfold(prepareRefGeometry(refScene), "jersey"),
    [refScene],
  );
  const shorts = useMemo(() => withUnfold(buildShortsGeometry(), "shorts"), []);
  const socks = useMemo(() => withUnfold(buildSocksGeometry(), "socks"), []);

  useEffect(() => () => jersey.geometry.dispose(), [jersey]);
  useEffect(() => () => shorts.geometry.dispose(), [shorts]);
  useEffect(() => () => socks.geometry.dispose(), [socks]);

  const show = (g: GarmentId) => focus === "all" || focus === g;
  const common = { design, revision, onPickZone, unfolded, drag };

  return (
    <group position={[0, KIT_Y, 0]}>
      <GarmentMesh {...common} garment="jersey" {...jersey} visible={show("jersey")} />
      <GarmentMesh {...common} garment="shorts" {...shorts} visible={show("shorts")} />
      <GarmentMesh {...common} garment="socks" {...socks} visible={show("socks")} />
    </group>
  );
}

useGLTF.preload(REF_MODEL_URL);
