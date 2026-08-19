import type { ZoneId } from "@core/types";

/**
 * ATLAS DE PATRÓN
 * ===============
 * Esta es la decisión central del proyecto: el layout UV del modelo 3D
 * *es* el layout de corte de la prenda real.
 *
 *   ┌───────────┬───────────┬──────┐
 *   │ DELANTERO │  ESPALDA  │ MANGA│
 *   │           │           │ ─────│
 *   │           │           │ MANGA│
 *   ├───────────┴───────────┴──────┤
 *   │ CUELLO                       │
 *   └──────────────────────────────┘
 *
 * Consecuencias de que sea así y no un unwrap automático:
 *  - Las costuras del 3D coinciden con las costuras reales, así que un
 *    patrón que cruza de delantero a manga se puede alinear de verdad.
 *  - El mismo canvas que alimenta la textura, renderizado a 300 DPI en vez
 *    de 2048 px, es el archivo que va a la sublimadora. El export para
 *    fabricación no es una feature nueva: es el mismo render a otra escala.
 *  - La vista "plano" del editor es literalmente este canvas.
 */

export type PieceId = "front" | "back" | "sleeveL" | "sleeveR" | "collar";

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
   * El par indica el valor en el borde izquierdo y derecho del rectángulo. Los patrones se calculan
   * en este espacio, no en el del rectángulo, y por eso una raya vertical
   * sale continua al cruzar la costura lateral.
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

export const PIECE_BY_ID: Record<PieceId, Piece> = Object.fromEntries(
  JERSEY_PIECES.map((p) => [p.id, p]),
) as Record<PieceId, Piece>;

/** Resolución del atlas. 2048 en interacción; 4096 para export. */
export const ATLAS_SIZE = 2048;
