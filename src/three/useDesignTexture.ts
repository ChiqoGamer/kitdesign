"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { DesignState } from "@core/index";
import { createAtlasCanvas, renderDesign } from "@render/canvas";

const LIVE_SIZE = 2048;

/**
 * Mantiene una única CanvasTexture viva y la re-dibuja cuando cambia el
 * diseño. Nunca se recrea la textura: sólo se marca `needsUpdate`, que es
 * lo que permite arrastrar un slider a 60fps sin reasignar memoria de GPU
 * en cada frame.
 */
export function useDesignTexture(
  design: DesignState,
  revision: number,
): THREE.CanvasTexture {
  const texture = useMemo(() => {
    const canvas = createAtlasCanvas(LIVE_SIZE);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }, []);

  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderDesign(ctx, design, LIVE_SIZE);
    texture.needsUpdate = true;
  }, [design, revision, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
