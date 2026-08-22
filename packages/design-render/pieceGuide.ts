/**
 * GUÍA DE PIEZAS
 * ==============
 * Dibuja las siluetas reales de los moldes sobre la plantilla, para que se
 * vea qué zona de la imagen cae en cada parte de la camiseta.
 *
 * Los triángulos vienen del desplegado UV del propio modelo, así que la
 * silueta es exacta: la curva de la sisa, la caída del hombro y el escote
 * son los de la prenda, no un rectángulo que los aproxima.
 *
 * Este módulo sólo pinta; no sabe cargar el modelo. Recibe los triángulos ya
 * calculados para no arrastrar three.js dentro del renderer.
 */

export type PieceId = "front" | "back" | "sleeveL" | "sleeveR" | "collar";

/** Triángulos en UV (v con 0 arriba), como los devuelve el modelo. */
export type PieceTriangles = Record<PieceId, Float32Array>;

interface PieceStyle {
  fill: string;
  label: string;
  /**
   * La pieza va cabeza abajo en la plantilla y el rótulo se dibuja girado
   * para avisarlo. Sólo la espalda: el desplegado es "mariposa" y el escote
   * cae en el medio, así que queda invertida respecto del frente.
   */
  upsideDown?: boolean;
}

/**
 * Un color por parte. No son decorativos: es la única forma de distinguir
 * de un vistazo las dos mangas, que tienen silueta casi idéntica y quedan
 * enfrentadas.
 */
export const PIECE_STYLES: Record<PieceId, PieceStyle> = {
  front: { fill: "#E86A78", label: "DELANTERO" },
  back: { fill: "#2F5FD0", label: "ESPALDA", upsideDown: true },
  sleeveR: { fill: "#4FC58B", label: "MANGA DERECHA" },
  sleeveL: { fill: "#6FD3A6", label: "MANGA IZQUIERDA" },
  collar: { fill: "#8A9099", label: "CUELLO" },
};

const ORDER: PieceId[] = ["back", "front", "sleeveR", "sleeveL", "collar"];

function tracePiece(
  ctx: CanvasRenderingContext2D,
  tris: Float32Array,
  size: number,
) {
  ctx.beginPath();
  for (let i = 0; i < tris.length; i += 6) {
    ctx.moveTo(tris[i] * size, tris[i + 1] * size);
    ctx.lineTo(tris[i + 2] * size, tris[i + 3] * size);
    ctx.lineTo(tris[i + 4] * size, tris[i + 5] * size);
    ctx.closePath();
  }
}

/** Centro y alto aproximados de una pieza, para ubicar su rótulo. */
function bounds(tris: Float32Array) {
  let u0 = 1,
    u1 = 0,
    v0 = 1,
    v1 = 0;
  for (let i = 0; i < tris.length; i += 2) {
    u0 = Math.min(u0, tris[i]);
    u1 = Math.max(u1, tris[i]);
    v0 = Math.min(v0, tris[i + 1]);
    v1 = Math.max(v1, tris[i + 1]);
  }
  return { u0, u1, v0, v1, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2 };
}

/**
 * Guía en limpio: cada molde relleno con su color y su nombre. Es lo que se
 * abre de fondo en un editor de imágenes para diseñar desde cero.
 */
export function renderPieceGuide(
  ctx: CanvasRenderingContext2D,
  tris: PieceTriangles,
  size: number,
  { labels = true }: { labels?: boolean } = {},
): void {
  ctx.clearRect(0, 0, size, size);
  for (const id of ORDER) {
    const t = tris[id];
    if (!t?.length) continue;
    tracePiece(ctx, t, size);
    ctx.fillStyle = PIECE_STYLES[id].fill;
    ctx.fill();
  }
  if (labels) drawLabels(ctx, tris, size);
}

/**
 * Contorno y rótulo sobre un diseño ya pintado. Va en un canvas aparte del
 * contenido: si se dibujara encima, la plantilla descargada saldría con los
 * rótulos estampados sobre la tela.
 */
export function renderPieceOutlines(
  ctx: CanvasRenderingContext2D,
  tris: PieceTriangles,
  size: number,
): void {
  ctx.clearRect(0, 0, size, size);

  // Fuera de los moldes se atenúa: ahí la imagen no se ve en la prenda.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  for (const id of ORDER) {
    const t = tris[id];
    if (t?.length) tracePiece(ctx, t, size);
  }
  ctx.fillStyle = "rgba(11, 13, 16, 0.82)";
  ctx.fill("evenodd");
  ctx.restore();

  for (const id of ORDER) {
    const t = tris[id];
    if (!t?.length) continue;
    tracePiece(ctx, t, size);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = Math.max(1, size * 0.0012);
    ctx.stroke();
  }
  drawLabels(ctx, tris, size);
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  tris: PieceTriangles,
  size: number,
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.round(size * 0.024);

  for (const id of ORDER) {
    const t = tris[id];
    if (!t?.length) continue;
    const style = PIECE_STYLES[id];
    const b = bounds(t);
    const pieceW = (b.u1 - b.u0) * size;
    const pieceH = (b.v1 - b.v0) * size;

    ctx.save();
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    const w = ctx.measureText(style.label).width;

    // El cuello es un óvalo diminuto: cualquier rótulo lo tapa entero.
    if (pieceH < fs * 2.2) {
      ctx.restore();
      continue;
    }

    ctx.translate(b.cu * size, b.cv * size);
    if (style.upsideDown) ctx.rotate(Math.PI);
    // Las mangas son altas y angostas: el rótulo horizontal se les sale.
    // Girarlo lo mete adentro en vez de achicarlo hasta no leerse.
    if (w + fs > pieceW && pieceH > w + fs) ctx.rotate(Math.PI / 2);

    ctx.fillStyle = "rgba(11,13,16,0.55)";
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 12, -fs * 0.8, w + 24, fs * 1.6, fs * 0.4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(style.label, 0, 1);
    ctx.restore();
  }
}
