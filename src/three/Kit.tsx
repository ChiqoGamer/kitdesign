"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DesignState, GarmentId, ZoneId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { buildJerseyGeometry } from "@geom/jersey";
import { buildShortsGeometry } from "@geom/shorts";
import { buildSocksGeometry } from "@geom/socks";
import { useGarmentTexture } from "./useGarmentTexture";

/**
 * Disposición del kit completo en escena, estilo "equipación flotante":
 * camiseta arriba, short solapado detrás del ruedo, medias abajo con un
 * pequeño espacio — como se presenta un kit en los juegos.
 */
export const KIT_LAYOUT: Record<GarmentId, { y: number; z: number }> = {
  jersey: { y: 0.08, z: 0 },
  shorts: { y: -0.26, z: -0.012 },
  socks: { y: -0.87, z: 0.01 },
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
        side={THREE.DoubleSide}
        roughness={0.74}
        metalness={0}
        sheen={0.16}
        sheenRoughness={0.85}
        sheenColor={new THREE.Color("#ffffff")}
        clearcoat={0.02}
        envMapIntensity={0.55}
      />
    </mesh>
  );
}

export type KitFocus = GarmentId | "all";

interface Props {
  design: DesignState;
  revision: number;
  focus: KitFocus;
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

export function Kit({ design, revision, focus, onPickZone, onHoverZone }: Props) {
  const { collar, sleeve } = design.kit.construction;

  // La geometría de la camiseta sólo se reconstruye cuando cambia la
  // confección; short y medias son fijas. Los colores los absorbe la textura.
  const jerseyGeo = useMemo(
    () => buildJerseyGeometry({ collar, sleeve }),
    [collar, sleeve],
  );
  const shortsGeo = useMemo(() => buildShortsGeometry(), []);
  const socksGeo = useMemo(() => buildSocksGeometry(), []);

  useEffect(() => () => jerseyGeo.dispose(), [jerseyGeo]);
  useEffect(() => () => shortsGeo.dispose(), [shortsGeo]);
  useEffect(() => () => socksGeo.dispose(), [socksGeo]);

  const show = (g: GarmentId) => focus === "all" || focus === g;
  const common = { design, revision, onPickZone, onHoverZone };

  return (
    <group position={[0, 0.02, 0]}>
      <GarmentMesh {...common} garment="jersey" geometry={jerseyGeo} visible={show("jersey")} />
      <GarmentMesh {...common} garment="shorts" geometry={shortsGeo} visible={show("shorts")} />
      <GarmentMesh {...common} garment="socks" geometry={socksGeo} visible={show("socks")} />
    </group>
  );
}
