"use client";

import * as THREE from "three";

/**
 * Normal map de tejido generado proceduralmente.
 *
 * El realismo de una camiseta 3D no viene de la malla: viene de que la
 * superficie no sea ópticamente lisa. Un knit de poliéster sublimado tiene
 * un micro-relieve en diagonal (columnas de puntos) que rompe el especular.
 * Generarlo por código evita depender de una textura descargada y permite
 * ajustar la escala del punto sin re-exportar assets.
 *
 * Método: se construye un campo de alturas del tejido y se convierte a
 * normales por diferencias finitas (sobel simple).
 */

const SIZE = 256;

function buildHeightField(): Float32Array {
  const h = new Float32Array(SIZE * SIZE);
  const stitchesX = 14; // columnas de puntos por tile
  const stitchesY = 20; // filas (más filas que columnas, como un jersey knit)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * stitchesX * Math.PI * 2;
      const v = (y / SIZE) * stitchesY * Math.PI * 2;
      // Punto de tejido: dos ondas desfasadas en zig-zag producen la
      // apariencia de "V" encadenada del punto jersey.
      const zig = Math.sin(u + Math.sin(v * 0.5) * 0.9);
      const row = Math.sin(v);
      let height = zig * 0.6 + row * 0.4;
      // Variación de hilo: ruido determinista de baja amplitud.
      const n =
        Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      height += ((n - Math.floor(n)) - 0.5) * 0.25;
      h[y * SIZE + x] = height;
    }
  }
  return h;
}

function heightToNormalMap(h: Float32Array): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const strength = 1.1;

  const at = (x: number, y: number) =>
    h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

let cached: THREE.CanvasTexture | null = null;

/** Textura compartida entre todas las prendas (se genera una sola vez). */
export function getFabricNormalMap(): THREE.CanvasTexture {
  if (cached) return cached;
  const tex = new THREE.CanvasTexture(heightToNormalMap(buildHeightField()));
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 11);
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cached = tex;
  return tex;
}

let cachedRough: THREE.CanvasTexture | null = null;

/**
 * Mapa de rugosidad sutil. Una tela real no tiene brillo uniforme: hay
 * zonas apenas más satinadas que otras. Romper la rugosidad constante
 * evita el aspecto "plástico" y hace que el especular respire.
 */
export function getFabricRoughnessMap(): THREE.CanvasTexture {
  if (cachedRough) return cachedRough;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Mezcla de dos frecuencias → manchas suaves de satinado.
      const a = Math.sin(x * 0.09) * Math.cos(y * 0.11);
      const b = Math.sin((x + y) * 0.21);
      const v = 0.72 + (a * 0.06 + b * 0.04);
      const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
      const i = (y * SIZE + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  cachedRough = tex;
  return tex;
}
