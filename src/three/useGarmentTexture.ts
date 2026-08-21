"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { DesignState, GarmentId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import {
  createAtlasCanvas,
  renderGarment,
  type RenderOptions,
} from "@render/canvas";
import { onImagesReady } from "@render/images";

/**
 * Mantiene una única CanvasTexture viva por prenda y la re-dibuja cuando
 * cambia el diseño. Nunca se recrea la textura: sólo se marca
 * `needsUpdate`, que es lo que permite arrastrar un slider a 60fps sin
 * reasignar memoria de GPU en cada frame.
 */
export function useGarmentTexture(
  design: DesignState,
  revision: number,
  garment: GarmentId,
  options: RenderOptions = {},
): THREE.CanvasTexture {
  // Las imágenes de las capas (escudos, sponsors) cargan async. Cuando una
  // termina, se fuerza un redibujo de la textura para que aparezca.
  const [imgTick, setImgTick] = useState(0);
  useEffect(() => onImagesReady(() => setImgTick((n) => n + 1)), []);

  // Clave estable de las opciones: evita redibujar en cada render.
  const optionsKey = JSON.stringify(options.paintedCollar ?? null);

  const texture = useMemo(() => {
    const canvas = createAtlasCanvas(GARMENT_ATLASES[garment].size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, [garment]);

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderGarment(ctx, design, garment);
    texture.needsUpdate = true;
  }, [design, revision, garment, texture, imgTick, optionsKey]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
