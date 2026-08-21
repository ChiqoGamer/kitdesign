import { resolveColor, type DesignState, type GarmentId } from "@core/types";
import {
  ANCHORS,
  FONT_STACKS,
  layerGarment,
  type Layer,
  type NumberLayer,
  type TextLayer,
} from "@core/layers";
import { PAINTERS, type PaintContext } from "./patterns";
import { refFaceRegion, refSleeveRegion } from "./importTexture";
import { getImage } from "./images";

/**
 * VISTA PLANA 2D
 * ==============
 * Una ilustración plana de la prenda (frente y espalda), rellenada con el
 * mismo patrón/colores/capas que el 3D. Es la forma más clara de ver y
 * revisar un diseño: se lee de un vistazo, sin rotar ni pelear con el 3D.
 *
 * Reutiliza los mismos painters de patrón que la textura, así que un cambio
 * de color o de rayas se ve idéntico acá y en el modelo.
 */

export type FlatSide = "front" | "back";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Punto normalizado (0..1 dentro de la caja) → pixel. */
function pt(box: Box, nx: number, ny: number): [number, number] {
  return [box.x + nx * box.w, box.y + ny * box.h];
}

/**
 * Silueta de camiseta en coordenadas normalizadas (y hacia abajo).
 * `neckDip` controla cuánto baja el escote (frente más que espalda).
 */
function jerseyPaths(box: Box, neckDip: number) {
  const P = (nx: number, ny: number) => pt(box, nx, ny);

  const outline = new Path2D();
  // Escote izquierdo arriba
  outline.moveTo(...P(0.42, 0.05));
  // hombro izquierdo
  outline.quadraticCurveTo(...P(0.37, 0.05), ...P(0.33, 0.09));
  // manga: borde superior externo
  outline.quadraticCurveTo(...P(0.24, 0.11), ...P(0.14, 0.17));
  // manga: hem externo
  outline.quadraticCurveTo(...P(0.10, 0.24), ...P(0.12, 0.32));
  // manga: hem inferior hacia adentro
  outline.lineTo(...P(0.27, 0.29));
  // axila
  outline.quadraticCurveTo(...P(0.30, 0.30), ...P(0.31, 0.40));
  // lateral hasta el ruedo
  outline.lineTo(...P(0.30, 0.93));
  // ruedo con leve curva
  outline.quadraticCurveTo(...P(0.5, 0.965), ...P(0.70, 0.93));
  // lateral derecho subiendo
  outline.lineTo(...P(0.69, 0.40));
  outline.quadraticCurveTo(...P(0.70, 0.30), ...P(0.73, 0.29));
  // manga derecha
  outline.lineTo(...P(0.88, 0.32));
  outline.quadraticCurveTo(...P(0.90, 0.24), ...P(0.86, 0.17));
  outline.quadraticCurveTo(...P(0.76, 0.11), ...P(0.67, 0.09));
  // hombro derecho al escote
  outline.quadraticCurveTo(...P(0.63, 0.05), ...P(0.58, 0.05));
  // escote (curva que baja al centro)
  outline.quadraticCurveTo(...P(0.5, 0.05 + neckDip), ...P(0.42, 0.05));
  outline.closePath();

  // Región del cuerpo (torso, sin mangas) para el patrón del cuerpo.
  const body = new Path2D();
  body.moveTo(...P(0.34, 0.09));
  body.quadraticCurveTo(...P(0.31, 0.16), ...P(0.31, 0.40));
  body.lineTo(...P(0.30, 0.93));
  body.quadraticCurveTo(...P(0.5, 0.965), ...P(0.70, 0.93));
  body.lineTo(...P(0.69, 0.40));
  body.quadraticCurveTo(...P(0.69, 0.16), ...P(0.66, 0.09));
  body.quadraticCurveTo(...P(0.5, 0.05 + neckDip + 0.03), ...P(0.34, 0.09));
  body.closePath();

  const sleeveL = new Path2D();
  sleeveL.moveTo(...P(0.34, 0.09));
  sleeveL.quadraticCurveTo(...P(0.24, 0.11), ...P(0.14, 0.17));
  sleeveL.quadraticCurveTo(...P(0.10, 0.24), ...P(0.12, 0.32));
  sleeveL.lineTo(...P(0.27, 0.29));
  sleeveL.quadraticCurveTo(...P(0.30, 0.22), ...P(0.31, 0.14));
  sleeveL.closePath();

  const sleeveR = new Path2D();
  sleeveR.moveTo(...P(0.66, 0.09));
  sleeveR.quadraticCurveTo(...P(0.76, 0.11), ...P(0.86, 0.17));
  sleeveR.quadraticCurveTo(...P(0.90, 0.24), ...P(0.88, 0.32));
  sleeveR.lineTo(...P(0.73, 0.29));
  sleeveR.quadraticCurveTo(...P(0.70, 0.22), ...P(0.69, 0.14));
  sleeveR.closePath();

  // Cinta del cuello: banda a lo largo del escote.
  const collar = new Path2D();
  collar.moveTo(...P(0.40, 0.05));
  collar.quadraticCurveTo(...P(0.5, 0.05 + neckDip), ...P(0.60, 0.05));
  collar.quadraticCurveTo(...P(0.5, 0.05 + neckDip + 0.055), ...P(0.40, 0.05));
  collar.closePath();

  return { outline, body, sleeveL, sleeveR, collar };
}

function paintRegion(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  zone: "body" | "sleeves" | "collar",
  region: Path2D,
  box: Box,
  gu: [number, number],
) {
  const fill = state.kit.zones[zone];
  if (fill.hidden) return;
  ctx.save();
  ctx.clip(region);
  const context: PaintContext = {
    ctx,
    rect: { x: box.x, y: box.y, w: box.w, h: box.h },
    gu,
    gv: [0, 1],
    colors: fill.colors.map((c: string) => resolveColor(state, c)),
    params: fill.params,
  };
  PAINTERS[fill.pattern](context);
  ctx.restore();
}


/**
 * Pinta una región de la vista plana con la textura importada.
 *
 * La 2D no usa el atlas sino la silueta, así que acá no hay remapeo: se
 * estira la región del origen sobre el bounding box de la pieza y se
 * recorta con su Path2D. Es una aproximación — la silueta plana no tiene
 * la misma forma que la pieza desplegada — pero es la lectura correcta del
 * diseño, que es para lo que se usa esta vista. El 3D y el archivo de
 * impresión siguen saliendo del atlas, que sí es exacto.
 */
function paintRegionImported(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  region: Path2D,
  box: Box,
  src: { sx: number; sy: number; sw: number; sh: number },
  flipX = false,
  flipY = false,
): void {
  ctx.save();
  ctx.clip(region);
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(
    img,
    src.sx,
    src.sy,
    src.sw,
    src.sh,
    -box.w / 2,
    -box.h / 2,
    box.w,
    box.h,
  );
  ctx.restore();
}

/** Dibuja una prenda en vista plana dentro de la caja dada. */
export function renderFlatJersey(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  side: FlatSide,
  box: Box,
): void {
  const neckDip = side === "front" ? 0.09 : 0.045;
  const paths = jerseyPaths(box, neckDip);

  // Patrón por zona. El cuerpo mapea gu como la cara frontal/trasera del
  // torso, para que las rayas se vean como en el 3D.
  const bodyGu: [number, number] =
    side === "front" ? [0.19, -0.19] : [0.69, 0.31];

  const imported = state.kit.texture ? getImage(state.kit.texture.src) : null;
  if (imported) {
    const face = refFaceRegion(imported, side === "front" ? "front" : "back");
    // El espejado horizontal del atlas no aplica acá: la 2D de la espalda se
    // mira de frente, no desde adentro de la prenda.
    paintRegionImported(ctx, imported, paths.body, box, face, false, face.flipY);
    const sl = refSleeveRegion(imported);
    paintRegionImported(ctx, imported, paths.sleeveL, box, sl, false, true);
    paintRegionImported(ctx, imported, paths.sleeveR, box, sl, false, true);
    paintRegion(ctx, state, "collar", paths.collar, box, [0, 1]);
  } else {
    paintRegion(ctx, state, "body", paths.body, box, bodyGu);
    paintRegion(ctx, state, "sleeves", paths.sleeveL, box, [0, 1]);
    paintRegion(ctx, state, "sleeves", paths.sleeveR, box, [1, 0]);
    paintRegion(ctx, state, "collar", paths.collar, box, [0, 1]);

    // Paneles (hombro y laterales) por encima de la base.
    paintFlatPanels(ctx, state, paths, box);
  }

  // Sombra de contacto muy sutil en el borde para dar volumen.
  ctx.save();
  ctx.clip(paths.outline);
  const grad = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  grad.addColorStop(0, "rgba(0,0,0,0.06)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = grad;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();

  // Contorno.
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1.5, box.w * 0.004);
  ctx.stroke(paths.outline);

  // Capas de esta cara.
  ctx.save();
  ctx.clip(paths.outline);
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    if (layerGarment(layer) !== "jersey") continue;
    if (ANCHORS[layer.anchor].flat.side !== side) continue;
    drawFlatLayer(ctx, state, layer, box);
  }
  ctx.restore();
}

function drawFlatLayer(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  layer: Layer,
  box: Box,
): void {
  const a = ANCHORS[layer.anchor];
  const [cx, cy] = pt(
    box,
    a.flat.x + layer.offset.x,
    a.flat.y - layer.offset.y,
  );
  const base = a.baseSize * box.w * 1.15 * layer.scale;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);

  if (layer.kind === "logo") {
    const img = getImage(layer.src);
    if (img) {
      const ratio = img.width / img.height || 1;
      const w = ratio >= 1 ? base : base * ratio;
      const h = ratio >= 1 ? base / ratio : base;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
  } else if (layer.kind === "text") {
    const t = layer as TextLayer;
    ctx.font = `700 ${base}px ${FONT_STACKS[t.font]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = resolveColor(state, t.color);
    ctx.fillText(t.text.toUpperCase(), 0, 0);
  } else {
    const n = layer as NumberLayer;
    ctx.font = `800 ${base}px ${FONT_STACKS[n.font]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = base * 0.08;
    ctx.lineJoin = "round";
    ctx.strokeStyle = resolveColor(state, n.outline);
    ctx.strokeText(n.value, 0, 0);
    ctx.fillStyle = resolveColor(state, n.color);
    ctx.fillText(n.value, 0, 0);
  }
  ctx.restore();
}


const SIDE_FRAC_F = 0.09; // ancho de la franja lateral (fracción de la caja)
const SHOULDER_TOP = 0.05;
const SHOULDER_BOTTOM = 0.24;

/** Pinta paneles de hombro y laterales sobre la silueta plana. */
function paintFlatPanels(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  paths: { outline: Path2D; body: Path2D },
  box: Box,
): void {
  const shoulder = state.kit.zones.shoulderPanels;
  const side = state.kit.zones.sidePanels;

  // Panel de hombro: banda superior, recortada a toda la silueta
  // (cubre hombros y parte alta de las mangas).
  if (!shoulder.hidden) {
    ctx.save();
    ctx.clip(paths.outline);
    ctx.fillStyle = resolveColor(state, shoulder.colors[0]);
    ctx.fillRect(
      box.x,
      box.y + box.h * SHOULDER_TOP,
      box.w,
      box.h * (SHOULDER_BOTTOM - SHOULDER_TOP),
    );
    ctx.restore();
  }

  // Paneles laterales: franjas verticales en los lados, recortadas al torso.
  if (!side.hidden) {
    ctx.save();
    ctx.clip(paths.body);
    ctx.fillStyle = resolveColor(state, side.colors[0]);
    // franja izquierda
    ctx.fillRect(box.x + box.w * 0.30, box.y, box.w * SIDE_FRAC_F, box.h);
    // franja derecha
    ctx.fillRect(
      box.x + box.w * (0.70 - SIDE_FRAC_F),
      box.y,
      box.w * SIDE_FRAC_F,
      box.h,
    );
    ctx.restore();
  }
}
