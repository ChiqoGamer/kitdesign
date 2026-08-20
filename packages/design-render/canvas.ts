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
import { PAINTERS, type PaintContext } from "./patterns";

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

  // Fondo con el color base de la zona principal: si alguna UV se escapa
  // un pixel del molde, el error es invisible en vez de un borde negro.
  ctx.fillStyle = resolveColor(
    state,
    state.kit.zones[atlas.backdropZone].colors[0],
  );
  ctx.fillRect(0, 0, px, px);

  for (const piece of atlas.pieces) {
    const fill = state.kit.zones[piece.zone];
    const painter = PAINTERS[fill.pattern];
    const rect = toPixels(piece, px, BLEED);

    // El sangrado agranda el rectángulo destino, así que hay que estirar
    // el rango de coordenadas de prenda en la misma proporción para que el
    // patrón no se corra respecto a la UV real.
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
}
