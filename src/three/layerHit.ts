import { ANCHORS, layerGarment, type DesignState, type GarmentId, type Layer } from "@core/index";

/**
 * QUÉ CAPA HAY BAJO EL CURSOR
 * ===========================
 * El raycast de three.js sobre la prenda devuelve la UV del punto tocado, y
 * la UV es el mismo espacio en el que el renderer de la textura ubica las
 * capas (anclaje + offset). Así que para saber si el cursor está sobre el
 * escudo no hace falta proyectar nada: se compara en UV.
 *
 * Las cajas copian cómo dibuja `drawLayer`: el logo entra en un cuadrado de
 * lado `s`, y el texto usa una fuente de alto `s` con ~0.62·s por letra.
 */

export interface LayerHit {
  layer: Layer;
  /** Centro actual de la capa en UV. */
  center: { x: number; y: number };
}

export function layerCenter(layer: Layer): { x: number; y: number } {
  const a = ANCHORS[layer.anchor];
  return { x: a.uv.x + layer.offset.x, y: a.uv.y + layer.offset.y };
}

function halfSize(layer: Layer): { w: number; h: number } {
  const s = ANCHORS[layer.anchor].baseSize * layer.scale;
  if (layer.kind === "logo") return { w: s * 0.5, h: s * 0.5 };
  const chars = layer.kind === "text" ? layer.text.length : layer.value.length;
  return { w: Math.max(s * 0.5, s * 0.31 * Math.max(1, chars)), h: s * 0.55 };
}

/**
 * Capa visible de esa prenda bajo el punto UV, o null. Si hay varias
 * superpuestas gana la de arriba (la última en la pila), que es la que se ve.
 */
export function layerAtUv(
  design: DesignState,
  garment: GarmentId,
  uv: { x: number; y: number },
): LayerHit | null {
  for (let i = design.layers.length - 1; i >= 0; i--) {
    const layer = design.layers[i];
    if (!layer.visible || layerGarment(layer) !== garment) continue;
    const c = layerCenter(layer);
    const { w, h } = halfSize(layer);
    // La rotación se ignora a propósito: con una caja algo generosa alcanza
    // para agarrar la capa, y no hace falta precisión de píxel.
    const r = Math.max(w, h) * (layer.rotation % 180 === 0 ? 0 : 1);
    const hw = Math.max(w, r);
    const hh = Math.max(h, r);
    if (Math.abs(uv.x - c.x) <= hw && Math.abs(uv.y - c.y) <= hh) {
      return { layer, center: c };
    }
  }
  return null;
}
