"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DesignState, GarmentId, ZoneId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { useGLTF } from "@react-three/drei";
import { prepareRefGeometry, REF_NECK_HOLE } from "./refJersey";
import { buildShortsGeometry } from "@geom/shorts";
import { buildSocksGeometry } from "@geom/socks";
import { useGarmentTexture } from "./useGarmentTexture";
import { getFabricNormalMap, getFabricRoughnessMap } from "./fabricNormal";
import type { CollarBandSpec } from "@render/canvas";

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
  /** Si la malla no trae cuello como pieza, se pinta la cinta en la textura. */
  collarBand?: CollarBandSpec | null;
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

function GarmentMesh({
  design,
  revision,
  garment,
  geometry,
  visible,
  collarBand,
  onPickZone,
  onHoverZone,
}: GarmentMeshProps) {
  const texture = useGarmentTexture(design, revision, garment, {
    paintedCollar: collarBand ?? null,
  });
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
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

export function Kit({ design, revision, focus, onPickZone, onHoverZone }: Props) {

  /**
   * Camiseta: GLB del editor open source, con sus UVs remapeadas a nuestro
   * atlas. Short y medias siguen siendo procedurales y son fijas; los
   * colores los absorbe la textura, así que no dependen del diseño.
   */
  const { scene: refScene } = useGLTF(REF_MODEL_URL);
  const jerseyGeo = useMemo(() => prepareRefGeometry(refScene), [refScene]);

  const shortsGeo = useMemo(() => buildShortsGeometry(), []);
  const socksGeo = useMemo(() => buildSocksGeometry(), []);

  useEffect(() => () => jerseyGeo.dispose(), [jerseyGeo]);
  useEffect(() => () => shortsGeo.dispose(), [shortsGeo]);
  useEffect(() => () => socksGeo.dispose(), [socksGeo]);

  const show = (g: GarmentId) => focus === "all" || focus === g;
  const common = { design, revision, onPickZone, onHoverZone };

  return (
    <group position={[0, 0.02, 0]}>
      <GarmentMesh
        {...common}
        garment="jersey"
        geometry={jerseyGeo}
        visible={show("jersey")}
        collarBand={{
          ...REF_NECK_HOLE,
          width: design.kit.construction.collarWidth ?? 0.028,
        }}
      />
      <GarmentMesh {...common} garment="shorts" geometry={shortsGeo} visible={show("shorts")} />
      <GarmentMesh {...common} garment="socks" geometry={socksGeo} visible={show("socks")} />
    </group>
  );
}

useGLTF.preload(REF_MODEL_URL);
