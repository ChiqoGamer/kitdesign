"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DesignState, GarmentId, ZoneId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { buildJerseyGeometry } from "@geom/jersey";
import { useGLTF } from "@react-three/drei";
import { prepareRefGeometry } from "./refJersey";
import { buildShortsGeometry } from "@geom/shorts";
import { buildSocksGeometry } from "@geom/socks";
import { useGarmentTexture } from "./useGarmentTexture";
import { getFabricNormalMap, getFabricRoughnessMap } from "./fabricNormal";

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

interface GarmentMeshProps {
  design: DesignState;
  revision: number;
  garment: GarmentId;
  geometry: THREE.BufferGeometry;
  visible: boolean;
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

function GarmentMesh({
  design,
  revision,
  garment,
  geometry,
  visible,
  onPickZone,
  onHoverZone,
}: GarmentMeshProps) {
  const texture = useGarmentTexture(design, revision, garment);
  const layout = KIT_LAYOUT[garment];

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const zone = zoneAtUv(garment, event.uv);
    if (zone) {
      event.stopPropagation();
      onPickZone?.(zone);
    }
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    onHoverZone?.(zoneAtUv(garment, event.uv));
  };

  return (
    <mesh
      geometry={geometry}
      position={[0, layout.y, layout.z]}
      visible={visible}
      castShadow
      receiveShadow
      onClick={visible ? handleClick : undefined}
      onPointerMove={visible ? handleMove : undefined}
      onPointerOut={visible ? () => onHoverZone?.(null) : undefined}
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
  /** true = malla de referencia (GLB); false = geometría procedural. */
  refMesh?: boolean;
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

export function Kit({ design, revision, focus, refMesh = false, onPickZone, onHoverZone }: Props) {
  const { collar, sleeve } = design.kit.construction;

  // La geometría de la camiseta sólo se reconstruye cuando cambia la
  // confección; short y medias son fijas. Los colores los absorbe la textura.
  // Malla de referencia (GLB del editor open source), con sus UVs
  // remapeadas a nuestro atlas. Se carga siempre para que el toggle sea
  // instantáneo; useGLTF cachea.
  const { scene: refScene } = useGLTF(REF_MODEL_URL);
  const refGeo = useMemo(() => prepareRefGeometry(refScene), [refScene]);

  const proceduralGeo = useMemo(
    () => buildJerseyGeometry({ collar, sleeve }),
    [collar, sleeve],
  );
  const shortsGeo = useMemo(() => buildShortsGeometry(), []);
  const socksGeo = useMemo(() => buildSocksGeometry(), []);

  useEffect(() => () => proceduralGeo.dispose(), [proceduralGeo]);
  useEffect(() => () => refGeo.dispose(), [refGeo]);

  useEffect(() => () => shortsGeo.dispose(), [shortsGeo]);
  useEffect(() => () => socksGeo.dispose(), [socksGeo]);

  const show = (g: GarmentId) => focus === "all" || focus === g;
  const common = { design, revision, onPickZone, onHoverZone };

  return (
    <group position={[0, 0.02, 0]}>
      <GarmentMesh
        {...common}
        garment="jersey"
        geometry={refMesh ? refGeo : proceduralGeo}
        visible={show("jersey")}
      />
      <GarmentMesh {...common} garment="shorts" geometry={shortsGeo} visible={show("shorts")} />
      <GarmentMesh {...common} garment="socks" geometry={socksGeo} visible={show("socks")} />
    </group>
  );
}

useGLTF.preload(REF_MODEL_URL);
