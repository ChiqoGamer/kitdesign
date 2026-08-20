import * as THREE from "three";

/**
 * Textura de cuadrícula UV para diagnóstico: cada celda tiene un color y su
 * coordenada (col,fila). Aplicada sobre una malla, deja ver cómo están
 * desplegadas sus UVs — si hay islas de molde (frente/espalda/mangas) o no.
 */
export function makeUvGrid(size = 1024, cells = 8): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const step = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const hue = ((x / cells) * 360) | 0;
      const light = 30 + (y / cells) * 45;
      ctx.fillStyle = `hsl(${hue} 70% ${light}%)`;
      ctx.fillRect(x * step, y * step, step, step);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.strokeRect(x * step, y * step, step, step);
      ctx.fillStyle = "white";
      ctx.font = `${step * 0.2}px sans-serif`;
      ctx.fillText(`${x},${y}`, x * step + 6, y * step + step * 0.28);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
