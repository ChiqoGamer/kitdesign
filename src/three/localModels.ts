"use client";

import { useEffect, useState } from "react";
import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GarmentId } from "@core/index";
import type { UnfoldInfo } from "./unfold";

/**
 * MODELOS LOCALES DE USO PERSONAL
 * ===============================
 * `public/models/local/{shorts,socks}.glb` son modelos de uso personal que
 * no se pueden redistribuir. Se generan en la máquina de quien los tiene
 * (con un conversor que vive en `local-models/`, también local) y las dos
 * carpetas están en .gitignore y .vercelignore: nunca llegan al repo ni al
 * sitio publicado. El GLB tiene que traer la UV ya en el atlas del proyecto
 * (pieza shortsR/L o sockR/L) y COLOR_0, como la malla procedural.
 *
 * Sólo se buscan en desarrollo: en producción no existen y pedirlos dejaría
 * un 404 en la consola de cada visita. Si falta el archivo se sigue con la
 * malla procedural sin avisar, porque es el caso normal para cualquiera que
 * clone el repo.
 */
export function useLocalGarment(
  garment: Extract<GarmentId, "shorts" | "socks">,
  prepare: (
    geometry: THREE.BufferGeometry,
    garment: GarmentId,
  ) => { geometry: THREE.BufferGeometry; unfold: UnfoldInfo },
): { geometry: THREE.BufferGeometry; unfold: UnfoldInfo } | null {
  const [result, setResult] = useState<{
    geometry: THREE.BufferGeometry;
    unfold: UnfoldInfo;
  } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;
    let loaded: THREE.BufferGeometry | null = null;
    new GLTFLoader().load(
      `/models/local/${garment}.glb`,
      (gltf) => {
        if (cancelled) return;
        let geometry: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!geometry && mesh.isMesh) geometry = mesh.geometry;
        });
        if (!geometry) return;
        loaded = geometry;
        setResult(prepare(geometry, garment));
      },
      undefined,
      () => {
        /* no hay modelo local: queda la malla procedural */
      },
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [garment, prepare]);

  return result;
}
