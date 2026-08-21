import { PIECE_BY_ID, type Piece } from "@geom/atlas";
import { REF_UV_LAYOUT, type UvRegion } from "@geom/refLayout";

/**
 * IMPORTAR UNA TEXTURA AJENA
 * ==========================
 * El modelo de referencia trae sus propias UVs, que son el layout de la
 * plantilla del editor de origen (ver `refLayout.ts`). Así que una textura
 * dibujada para ese layout ya tiene cada zona en su lugar: el pecho en el
 * óvalo rosa, la espalda en el azul, las mangas en el verde.
 *
 * Podríamos pintarla con las UVs originales, pero eso obliga a mantener dos
 * juegos de UVs y un material aparte, y la textura importada quedaría fuera
 * del pipeline: no se le podrían superponer logos ni números, ni saldría en
 * el PNG de impresión. En vez de eso la TRANSCODIFICAMOS a nuestro atlas.
 * Desde ahí es un fondo como cualquier otro y todo lo demás sigue igual.
 *
 * Lo que lo hace barato: el remapeo de UVs es lineal dentro de cada pieza
 * (un `norm` y a lo sumo un `1 - x`), así que cada pieza es un rectángulo
 * del origen a un rectángulo del destino, con espejados de eje. Eso es un
 * `drawImage`, no un recorrido pixel por pixel.
 */

/** Cómo cae una pieza de nuestro atlas dentro de la plantilla de origen. */
interface PieceMapping {
  region: UvRegion;
  /** El remapeo invierte u en esta pieza (espalda y manga izquierda). */
  flipX: boolean;
  /**
   * El eje v del origen y el de nuestro rect corren al revés.
   *
   * El torso viene desplegado en "mariposa": v = 0.5 es el escote y el
   * dobladillo queda en los dos extremos. Por eso el frente NO se invierte
   * (crece del escote hacia abajo igual que nuestro rect) y la espalda sí.
   */
  flipY: boolean;
}

const { torso, torsoNeckV, sleeveL, sleeveR, collar } = REF_UV_LAYOUT;

const MAPPING: Record<string, PieceMapping> = {
  front: {
    region: { ...torso, v0: torsoNeckV, v1: torso.v1 },
    flipX: false,
    flipY: false,
  },
  back: {
    region: { ...torso, v0: torso.v0, v1: torsoNeckV },
    flipX: true,
    flipY: true,
  },
  sleeveR: { region: sleeveR, flipX: false, flipY: true },
  sleeveL: { region: sleeveL, flipX: true, flipY: true },
  collar: { region: collar, flipX: false, flipY: true },
};

/** Una pieza de nuestro atlas ya resuelta a píxeles de destino. */
export interface DestRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Dibuja la región del origen que corresponde a `piece` sobre `dest`.
 *
 * `dest` viene con sangrado, así que estiramos la región del origen en la
 * misma proporción: el sangrado se llena con píxeles vecinos reales del
 * origen en vez de estirar el borde, que es lo que queremos para que el
 * filtrado bilineal no chupe fondo.
 */
export function drawImportedPiece(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  piece: Piece,
  dest: DestRect,
  bleed: number,
) {
  const map = MAPPING[piece.id];
  if (!map) return false;

  const iw = imageWidth(img);
  const ih = imageHeight(img);
  if (!iw || !ih) return false;

  const { region } = map;
  const sx = region.u0 * iw;
  const sy = region.v0 * ih;
  const sw = (region.u1 - region.u0) * iw;
  const sh = (region.v1 - region.v0) * ih;

  // Cuántos píxeles del origen equivalen al sangrado del destino.
  const padX = sw > 0 ? (bleed * sw) / Math.max(1, dest.w - bleed * 2) : 0;
  const padY = sh > 0 ? (bleed * sh) / Math.max(1, dest.h - bleed * 2) : 0;

  ctx.save();
  ctx.translate(dest.x + dest.w / 2, dest.y + dest.h / 2);
  ctx.scale(map.flipX ? -1 : 1, map.flipY ? -1 : 1);
  ctx.drawImage(
    img,
    sx - padX,
    sy - padY,
    sw + padX * 2,
    sh + padY * 2,
    -dest.w / 2,
    -dest.h / 2,
    dest.w,
    dest.h,
  );
  ctx.restore();
  return true;
}

/**
 * Región del origen que corresponde al frente o la espalda, en píxeles.
 * La usa la vista 2D, que no trabaja con el atlas sino con la silueta.
 */
export function refFaceRegion(img: CanvasImageSource, face: "front" | "back") {
  const iw = imageWidth(img);
  const ih = imageHeight(img);
  const map = MAPPING[face];
  const { region } = map;
  return {
    sx: region.u0 * iw,
    sy: region.v0 * ih,
    sw: (region.u1 - region.u0) * iw,
    sh: (region.v1 - region.v0) * ih,
    flipX: map.flipX,
    flipY: map.flipY,
  };
}

export function refSleeveRegion(img: CanvasImageSource) {
  const iw = imageWidth(img);
  const ih = imageHeight(img);
  const { region } = MAPPING.sleeveR;
  return {
    sx: region.u0 * iw,
    sy: region.v0 * ih,
    sw: (region.u1 - region.u0) * iw,
    sh: (region.v1 - region.v0) * ih,
  };
}

function imageWidth(img: CanvasImageSource): number {
  const anyImg = img as { naturalWidth?: number; width?: number };
  return anyImg.naturalWidth || anyImg.width || 0;
}

function imageHeight(img: CanvasImageSource): number {
  const anyImg = img as { naturalHeight?: number; height?: number };
  return anyImg.naturalHeight || anyImg.height || 0;
}

export { PIECE_BY_ID };
