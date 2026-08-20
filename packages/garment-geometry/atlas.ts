import type { GarmentId, ZoneId } from "@core/types";

/**
 * ATLAS DE PATRÓN
 * ===============
 * Esta es la decisión central del proyecto: el layout UV de cada prenda
 * *es* el layout de corte de la prenda real.
 *
 * Cada prenda tiene su propio atlas (mesh + textura independientes):
 * así los canvases quedan chicos, la vista 2D muestra cada molde por
 * separado y el export de producción se compone prenda por prenda.
 *
 * Consecuencias de que sea así y no un unwrap automático:
 *  - Las costuras del 3D coinciden con las costuras reales, así que un
 *    patrón que cruza de delantero a manga se puede alinear de verdad.
 *  - El mismo canvas que alimenta la textura, renderizado a 300 DPI en vez
 *    de 2048 px, es el archivo que va a la sublimadora. El export para
 *    fabricación no es una feature nueva: es el mismo render a otra escala.
 *  - La vista "Textura" del editor es literalmente este canvas.
 */

export type PieceId =
  | "front"
  | "back"
  | "sleeveL"
  | "sleeveR"
  | "collar"
  | "shortsL"
  | "shortsR"
  | "sockL"
  | "sockR";

/** Rectángulo en espacio UV (0..1, con Y hacia arriba como en glTF). */
export interface PieceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Piece {
  id: PieceId;
  /** Qué zona del DesignState pinta esta pieza. */
  zone: ZoneId;
  rect: PieceRect;
  /**
   * Tramo de "coordenada de prenda" que cubre la pieza.
   * Para el torso, `garmentU` es la posición alrededor del cuerpo medida en
   * longitud de arco, con 0 = centro delantero y ±0.5 = centro espalda.
   * El par indica el valor en el borde izquierdo y derecho del rectángulo.
   */
  garmentU: [number, number];
  garmentV: [number, number];
  label: string;
}

const MARGIN = 0.015;

export const JERSEY_PIECES: Piece[] = [
  {
    id: "front",
    zone: "body",
    rect: { x: MARGIN, y: 0.30, w: 0.36, h: 0.685 },
    garmentU: [0.25, -0.25],
    garmentV: [0, 1],
    label: "Delantero",
  },
  {
    id: "back",
    zone: "body",
    rect: { x: 0.39, y: 0.30, w: 0.36, h: 0.685 },
    garmentU: [0.75, 0.25],
    garmentV: [0, 1],
    label: "Espalda",
  },
  {
    id: "sleeveR",
    zone: "sleeves",
    rect: { x: 0.77, y: 0.645, w: 0.215, h: 0.34 },
    garmentU: [0, 1],
    garmentV: [0, 1],
    label: "Manga derecha",
  },
  {
    id: "sleeveL",
    zone: "sleeves",
    rect: { x: 0.77, y: 0.29, w: 0.215, h: 0.34 },
    garmentU: [0, 1],
    garmentV: [0, 1],
    label: "Manga izquierda",
  },
  {
    id: "collar",
    zone: "collar",
    rect: { x: MARGIN, y: 0.14, w: 0.36, h: 0.13 },
    garmentU: [0, 1],
    garmentV: [0, 1],
    label: "Cuello",
  },
];

/**
 * Piezas del short: una por pierna, con la costura en la cara interna.
 * Se espejan en U para que un patrón asimétrico salga simétrico respecto
 * al eje del cuerpo, como en la prenda cosida.
 */
export const SHORTS_PIECES: Piece[] = [
  {
    id: "shortsR",
    zone: "shorts",
    rect: { x: 0.52, y: 0.04, w: 0.46, h: 0.92 },
    garmentU: [0.25, -0.75],
    garmentV: [0, 1],
    label: "Pierna derecha",
  },
  {
    id: "shortsL",
    zone: "shorts",
    rect: { x: 0.02, y: 0.04, w: 0.46, h: 0.92 },
    garmentU: [-0.75, 0.25],
    garmentV: [0, 1],
    label: "Pierna izquierda",
  },
];

export const SOCKS_PIECES: Piece[] = [
  {
    id: "sockR",
    zone: "socks",
    rect: { x: 0.52, y: 0.04, w: 0.46, h: 0.92 },
    garmentU: [0, 1],
    garmentV: [0, 1],
    label: "Media derecha",
  },
  {
    id: "sockL",
    zone: "socks",
    rect: { x: 0.02, y: 0.04, w: 0.46, h: 0.92 },
    garmentU: [1, 0],
    garmentV: [0, 1],
    label: "Media izquierda",
  },
];

export interface GarmentAtlas {
  id: GarmentId;
  pieces: Piece[];
  /** Resolución del atlas en vivo. Para export se escala. */
  size: number;
  /** Zona cuyo color base pinta el fondo (tapa fugas de filtrado). */
  backdropZone: ZoneId;
}

export const GARMENT_ATLASES: Record<GarmentId, GarmentAtlas> = {
  jersey: { id: "jersey", pieces: JERSEY_PIECES, size: 2048, backdropZone: "body" },
  shorts: { id: "shorts", pieces: SHORTS_PIECES, size: 1024, backdropZone: "shorts" },
  socks: { id: "socks", pieces: SOCKS_PIECES, size: 1024, backdropZone: "socks" },
};

export const PIECE_BY_ID: Record<string, Piece> = Object.fromEntries(
  [...JERSEY_PIECES, ...SHORTS_PIECES, ...SOCKS_PIECES].map((p) => [p.id, p]),
);

/** Resolución del atlas de la camiseta (compatibilidad). */
export const ATLAS_SIZE = 2048;
