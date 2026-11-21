"use client";

/**
 * Acceso al canvas WebGL del visor para poder capturarlo.
 *
 * El renderer se registra al crearse en vez de buscar el canvas por
 * selector: así la exportación no depende del DOM que lo rodea.
 * Requiere `preserveDrawingBuffer: true` en el Canvas — sin eso el buffer
 * puede estar vacío al momento de leerlo.
 */

import type * as THREE from "three";

let viewerCanvas: HTMLCanvasElement | null = null;
let viewerScene: THREE.Scene | null = null;

/** La escena del visor, para exportar el kit como modelo 3D. */
export function registerViewerScene(scene: THREE.Scene | null): void {
  viewerScene = scene;
}

export function getViewerScene(): THREE.Scene | null {
  return viewerScene;
}

export function registerViewerCanvas(canvas: HTMLCanvasElement | null): void {
  viewerCanvas = canvas;
}

export function hasViewerCanvas(): boolean {
  return !!viewerCanvas;
}

/** PNG de lo que está en pantalla en el visor 3D, o null si no hay visor. */
export function captureViewerPng(): string | null {
  if (!viewerCanvas) return null;
  try {
    return viewerCanvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
