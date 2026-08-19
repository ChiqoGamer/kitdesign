"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { DesignState, ZoneId } from "@core/index";
import { buildJerseyGeometry } from "@geom/jersey";
import { JERSEY_PIECES } from "@geom/atlas";
import { useDesignTexture } from "./useDesignTexture";

/**
 * Traduce el punto UV de un raycast a la zona editable correspondiente.
 * Gracias a esto el modelo 3D *es* el selector: no hace falta un árbol de
 * capas para elegir "las mangas", se hace click sobre ellas.
 */
function zoneAtUv(uv: THREE.Vector2 | undefined): ZoneId | null {
  if (!uv) return null;
  for (const piece of JERSEY_PIECES) {
    const { x, y, w, h } = piece.rect;
    if (uv.x >= x && uv.x <= x + w && uv.y >= y && uv.y <= y + h) {
      return piece.zone;
    }
  }
  return null;
}

interface Props {
  design: DesignState;
  revision: number;
  onPickZone?: (zone: ZoneId) => void;
  onHoverZone?: (zone: ZoneId | null) => void;
}

export function Jersey({ design, revision, onPickZone, onHoverZone }: Props) {
  const { collar, sleeve } = design.jersey.construction;

  // La geometría sólo se reconstruye cuando cambia la confección, no en
  // cada cambio de color: eso lo absorbe la textura.
  const geometry = useMemo(
    () => buildJerseyGeometry({ collar, sleeve }),
    [collar, sleeve],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const texture = useDesignTexture(design, revision);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const zone = zoneAtUv(event.uv);
    if (zone) {
      event.stopPropagation();
      onPickZone?.(zone);
    }
  };

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    onHoverZone?.(zoneAtUv(event.uv));
  };

  return (
    <group position={[0, -0.37, 0]}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerMove={handleMove}
        onPointerOut={() => onHoverZone?.(null)}
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
    </group>
  );
}
