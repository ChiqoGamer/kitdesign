import {
  GARMENT_ATLASES,
  type GarmentAtlas,
  type Piece,
} from "@geom/atlas";
import {
  resolveColor,
  type DesignState,
  type GarmentId,
} from "@core/types";
import {
  ANCHORS,
  FONT_STACKS,
  layerGarment,
  type Layer,
  type NumberLayer,
  type TextLayer,
} from "@core/layers";
import { PAINTERS, type PaintContext } from "./patterns";
import { getImage } from "./images";

/**
 * CanvasRenderer: DesignState → atlas de textura de una prenda.
 *
 * Es determinista y sin estado: el mismo DesignState produce siempre el
 * mismo pixel. Eso es lo que permite que el mismo código genere la textura
 * del visor 3D y, cambiando sólo `size`, el archivo de impresión a
 * 300 DPI. Y es lo que hace testeable el editor por snapshot.
 */

/** Sangrado en píxeles: evita que el filtrado bilineal chupe el fondo. */
const BLEED = 6;

export function createAtlasCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** Convierte un rect en espacio UV (Y arriba) a píxeles de canvas (Y abajo). */
function toPixels(piece: Piece, size: number, bleed: number) {
  const { x, y, w, h } = piece.rect;
  return {
    x: x * size - bleed,
    y: (1 - (y + h)) * size - bleed,
    w: w * size + bleed * 2,
    h: h * size + bleed * 2,
  };
}

export function renderGarment(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  garment: GarmentId,
  size?: number,
): void {
  const atlas: GarmentAtlas = GARMENT_ATLASES[garment];
  const px = size ?? atlas.size;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = resolveColor(
    state,
    state.kit.zones[atlas.backdropZone].colors[0],
  );
  ctx.fillRect(0, 0, px, px);

  for (const piece of atlas.pieces) {
    const fill = state.kit.zones[piece.zone];
    const painter = PAINTERS[fill.pattern];
    const rect = toPixels(piece, px, BLEED);

    const sx = rect.w / (piece.rect.w * px);
    const sy = rect.h / (piece.rect.h * px);
    const midU = (piece.garmentU[0] + piece.garmentU[1]) / 2;
    const midV = (piece.garmentV[0] + piece.garmentV[1]) / 2;
    const expand = (
      pair: [number, number],
      mid: number,
      s: number,
    ): [number, number] => [
      mid + (pair[0] - mid) * s,
      mid + (pair[1] - mid) * s,
    ];

    const context: PaintContext = {
      ctx,
      rect,
      gu: expand(piece.garmentU, midU, sx),
      gv: expand(piece.garmentV, midV, sy),
      colors: fill.colors.map((c: string) => resolveColor(state, c)),
      params: fill.params,
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    painter(context);
    ctx.restore();
  }

  // Capas encima del patrón, en orden de apilado.
  ctx.imageSmoothingEnabled = true;
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    if (layerGarment(layer) !== garment) continue;
    drawLayer(ctx, state, layer, px);
  }
}

/** Punto de anclaje + offset → píxeles del canvas (Y hacia abajo). */
function anchorPx(layer: Layer, size: number) {
  const a = ANCHORS[layer.anchor];
  const ux = a.uv.x + layer.offset.x;
  const uy = a.uv.y + layer.offset.y;
  return {
    x: ux * size,
    y: (1 - uy) * size,
    base: a.baseSize * size,
    mirror: a.mirror,
  };
}

function withTransform(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  size: number,
  draw: () => void,
): void {
  const { x, y, mirror } = anchorPx(layer, size);
  ctx.save();
  ctx.translate(x, y);
  // La pieza destino puede estar espejada en el 3D (espalda, manga izq):
  // se invierte en X para que el texto/imagen se lea derecho una vez puesto.
  ctx.scale(mirror ? -1 : 1, 1);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  draw();
  ctx.restore();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  layer: Layer,
  size: number,
): void {
  const { base } = anchorPx(layer, size);
  const s = base * layer.scale;

  if (layer.kind === "logo") {
    const img = getImage(layer.src);
    if (!img) return;
    const ratio = img.width / img.height || 1;
    const w = ratio >= 1 ? s : s * ratio;
    const h = ratio >= 1 ? s / ratio : s;
    withTransform(ctx, layer, size, () => {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    });
    return;
  }

  if (layer.kind === "text") {
    drawText(ctx, state, layer, size, s);
    return;
  }
  drawNumber(ctx, state, layer, size, s);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  layer: TextLayer,
  size: number,
  s: number,
): void {
  withTransform(ctx, layer, size, () => {
    ctx.font = `700 ${s}px ${FONT_STACKS[layer.font]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = resolveColor(state, layer.color);
    ctx.fillText(layer.text.toUpperCase(), 0, 0);
  });
}

function drawNumber(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  layer: NumberLayer,
  size: number,
  s: number,
): void {
  withTransform(ctx, layer, size, () => {
    ctx.font = `800 ${s}px ${FONT_STACKS[layer.font]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = resolveColor(state, layer.outline);
    ctx.lineJoin = "round";
    ctx.strokeText(layer.value, 0, 0);
    ctx.fillStyle = resolveColor(state, layer.color);
    ctx.fillText(layer.value, 0, 0);
  });
}
