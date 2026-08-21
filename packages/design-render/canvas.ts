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
import { drawImportedPiece } from "./importTexture";

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

/**
 * Ubicación del escote dentro del rectángulo del torso, en coordenadas
 * normalizadas, y grosor de la cinta como fracción de la altura del rect.
 * Sólo aplica a mallas cuyo cuello no es una pieza aparte (ver
 * `paintedCollar`).
 */
export interface CollarBandSpec {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  width: number;
}

export interface RenderOptions {
  /**
   * Cuando la malla no trae cinta de cuello como pieza propia, se pinta un
   * anillo alrededor del escote. Dibujarlo en la textura da un borde suave
   * y un grosor exacto — reclasificar geometría dejaba el borde aserrado
   * sobre una malla low-poly.
   */
  paintedCollar?: CollarBandSpec | null;
}

export function renderGarment(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  garment: GarmentId,
  size?: number,
  options: RenderOptions = {},
): void {
  const atlas: GarmentAtlas = GARMENT_ATLASES[garment];
  const px = size ?? atlas.size;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = resolveColor(
    state,
    state.kit.zones[atlas.backdropZone].colors[0],
  );
  ctx.fillRect(0, 0, px, px);

  /**
   * Textura importada: sólo la camiseta, porque el layout de referencia
   * cubre esa prenda. El short y las medias siguen con su patrón, así que
   * un diseño importado se puede combinar con el resto del equipamiento.
   */
  const imported =
    garment === "jersey" && state.kit.texture
      ? getImage(state.kit.texture.src)
      : null;

  for (const piece of atlas.pieces) {
    const fill = state.kit.zones[piece.zone];
    const rect = toPixels(piece, px, BLEED);

    if (imported && drawImportedPiece(ctx, imported, piece, rect, BLEED)) {
      continue; // la textura manda: no pintamos el patrón debajo
    }

    if (fill.hidden) continue; // zona oculta: queda el color de fondo
    const painter = PAINTERS[fill.pattern];

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

  // Cinta de cuello pintada (mallas sin pieza de cuello propia).
  if (garment === "jersey" && options.paintedCollar && !imported) {
    paintCollarBand(ctx, state, atlas, px, options.paintedCollar);
  }

  // Paneles (hombro / laterales) por encima de la base, sólo en la camiseta.
  if (garment === "jersey" && !imported) {
    for (const piece of atlas.pieces) {
      paintPanels(ctx, state, piece, px);
    }
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


/** Rect exacto de la pieza en píxeles (sin sangrado). */
function exactRect(piece: Piece, px: number) {
  const { x, y, w, h } = piece.rect;
  return { x: x * px, y: (1 - (y + h)) * px, w: w * px, h: h * px };
}

/** Pinta la zona `zone` recortada a un sub-rect, con su gu/gv. */
function paintSub(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  zone: "shoulderPanels" | "sidePanels",
  clip: { x: number; y: number; w: number; h: number },
  gu: [number, number],
  gv: [number, number],
): void {
  const fill = state.kit.zones[zone];
  ctx.save();
  ctx.beginPath();
  ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();
  PAINTERS[fill.pattern]({
    ctx,
    rect: clip,
    gu,
    gv,
    colors: fill.colors.map((c: string) => resolveColor(state, c)),
    params: fill.params,
  });
  ctx.restore();
}

/** Ancho del panel lateral y alto del panel de hombro, como fracción. */
const SIDE_FRAC = 0.17;
const SHOULDER_FRAC = 0.2;
const SLEEVE_SHOULDER_FRAC = 0.42;

function paintPanels(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  piece: Piece,
  px: number,
): void {
  const side = state.kit.zones.sidePanels;
  const shoulder = state.kit.zones.shoulderPanels;
  const r = exactRect(piece, px);
  const [gu0, gu1] = piece.garmentU;
  const [gv0, gv1] = piece.garmentV;
  const isBody = piece.id === "front" || piece.id === "back";
  const isSleeve = piece.id === "sleeveL" || piece.id === "sleeveR";

  // Paneles laterales: franjas verticales en los bordes del torso (costuras).
  if (!side.hidden && isBody) {
    const guAt = (f: number) => gu0 + f * (gu1 - gu0);
    // Franja izquierda del rect
    paintSub(ctx, state, "sidePanels",
      { x: r.x, y: r.y, w: r.w * SIDE_FRAC, h: r.h },
      [gu0, guAt(SIDE_FRAC)], [gv0, gv1]);
    // Franja derecha del rect
    paintSub(ctx, state, "sidePanels",
      { x: r.x + r.w * (1 - SIDE_FRAC), y: r.y, w: r.w * SIDE_FRAC, h: r.h },
      [guAt(1 - SIDE_FRAC), gu1], [gv0, gv1]);
  }

  // Panel de hombro: banda superior del torso + zona de sisa de la manga.
  if (!shoulder.hidden) {
    const gvAt = (f: number) => gv1 - f * (gv1 - gv0); // f=0 arriba (v=gv1)
    if (isBody) {
      paintSub(ctx, state, "shoulderPanels",
        { x: r.x, y: r.y, w: r.w, h: r.h * SHOULDER_FRAC },
        [gu0, gu1], [gvAt(SHOULDER_FRAC), gv1]);
    } else if (isSleeve) {
      // La raíz (hombro) de la manga está en v=0 → parte inferior del rect.
      paintSub(ctx, state, "shoulderPanels",
        { x: r.x, y: r.y + r.h * (1 - SLEEVE_SHOULDER_FRAC), w: r.w, h: r.h * SLEEVE_SHOULDER_FRAC },
        [gu0, gu1], [gv0, gv0 + SLEEVE_SHOULDER_FRAC * (gv1 - gv0)]);
    }
  }
}


/**
 * Dibuja la cinta de cuello como un anillo alrededor de la abertura, en el
 * delantero y la espalda. Se recorta con regla "evenodd" (elipse exterior
 * menos interior) y dentro se corre el painter de la zona cuello, así la
 * cinta admite patrón y no sólo color plano.
 */
function paintCollarBand(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  atlas: GarmentAtlas,
  px: number,
  spec: CollarBandSpec,
): void {
  const fill = state.kit.zones.collar;
  if (fill.hidden) return;
  const painter = PAINTERS[fill.pattern];
  const colors = fill.colors.map((c: string) => resolveColor(state, c));

  for (const piece of atlas.pieces) {
    if (piece.id !== "front" && piece.id !== "back") continue;
    const r = exactRect(piece, px);
    const cx = r.x + spec.cx * r.w;
    const cy = r.y + (1 - spec.cy) * r.h; // cy=1 es el escote (arriba)
    const rxIn = spec.rx * r.w;
    const ryIn = spec.ry * r.h;
    const band = spec.width * r.h;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rxIn + band, ryIn + band, 0, 0, Math.PI * 2);
    ctx.ellipse(cx, cy, rxIn, ryIn, 0, 0, Math.PI * 2);
    ctx.clip("evenodd");
    painter({
      ctx,
      rect: r,
      gu: piece.garmentU,
      gv: piece.garmentV,
      colors,
      params: fill.params,
    });
    ctx.restore();
  }
}
