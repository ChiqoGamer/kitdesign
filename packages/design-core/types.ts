/**
 * DesignState — la fuente de verdad del editor.
 *
 * Reglas de este paquete:
 *  - No importa React, Three.js ni Next. TypeScript puro.
 *  - Todo cambio pasa por una acción (ver actions.ts). La UI y la IA usan
 *    exactamente el mismo camino.
 *  - `schema` versiona la forma del estado para poder migrar diseños viejos.
 */

/** Un color es un hex literal ("#0057B8") o una referencia a la paleta ("palette:0"). */
export type ColorRef = string;

/** Prendas del kit. Cada una es un mesh + un atlas de textura propios. */
export type GarmentId = "jersey" | "shorts" | "socks";

export const GARMENT_IDS: GarmentId[] = ["jersey", "shorts", "socks"];

export const GARMENT_LABELS: Record<GarmentId, string> = {
  jersey: "Camiseta",
  shorts: "Short",
  socks: "Medias",
};

/** Zonas editables del kit completo. Cada una mapea a piezas del patrón. */
export type ZoneId =
  | "body"
  | "sleeves"
  | "collar"
  | "shoulderPanels"
  | "sidePanels"
  | "shorts"
  | "socks";

export const ZONE_IDS: ZoneId[] = [
  "body",
  "sleeves",
  "collar",
  "shoulderPanels",
  "sidePanels",
  "shorts",
  "socks",
];

export const ZONE_LABELS: Record<ZoneId, string> = {
  body: "Cuerpo",
  sleeves: "Mangas",
  collar: "Cuello",
  shoulderPanels: "Paneles de hombro",
  sidePanels: "Paneles laterales",
  shorts: "Short",
  socks: "Medias",
};

/** A qué prenda pertenece cada zona (para foco de cámara y vista 2D). */
export const ZONE_GARMENT: Record<ZoneId, GarmentId> = {
  body: "jersey",
  sleeves: "jersey",
  collar: "jersey",
  shoulderPanels: "jersey",
  sidePanels: "jersey",
  shorts: "shorts",
  socks: "socks",
};

/** Zonas de cada prenda, para armar la UI. */
export const GARMENT_ZONES: Record<GarmentId, ZoneId[]> = {
  jersey: ["body", "sleeves", "collar"],
  shorts: ["shorts"],
  socks: ["socks"],
};

/** Catálogo cerrado de patrones. La IA sólo puede elegir de acá. */
export type PatternId =
  | "solid"
  | "stripesV"
  | "stripesH"
  | "halves"
  | "sash"
  | "gradient";

export const PATTERN_LABELS: Record<PatternId, string> = {
  solid: "Lisa",
  stripesV: "Rayas verticales",
  stripesH: "Rayas horizontales",
  halves: "Mitades",
  sash: "Banda diagonal",
  gradient: "Degradado",
};

/**
 * Parámetros de patrón. Un solo objeto plano para todos los patrones:
 * cada patrón lee los que le sirven e ignora el resto. Esto mantiene las
 * acciones simples y hace trivial el schema para el tool-use de la IA.
 */
export interface PatternParams {
  /** Cantidad de repeticiones alrededor / a lo largo de la prenda. */
  count: number;
  /** Grosor de la raya como fracción del paso (0..1). */
  width: number;
  /** Desfasaje del patrón (0..1). */
  offset: number;
  /** Inclinación en grados (banda diagonal). */
  angle: number;
  /** Posición del elemento (0..1) — usado por mitades y banda. */
  position: number;
}

export const DEFAULT_PATTERN_PARAMS: PatternParams = {
  count: 7,
  width: 0.5,
  offset: 0,
  angle: 20,
  position: 0.5,
};

export interface ZoneFill {
  pattern: PatternId;
  /** [base, secundario, terciario] — los patrones usan los que necesitan. */
  colors: [ColorRef, ColorRef, ColorRef];
  params: PatternParams;
  /** Oculta la zona en el render (deja ver el color de fondo). */
  hidden?: boolean;
}

export interface PaletteEntry {
  id: string;
  hex: string;
  name: string;
}

export type CollarKind = "crew" | "v";
export type SleeveKind = "short" | "long" | "sleeveless";

export const COLLAR_LABELS: Record<CollarKind, string> = {
  crew: "Redondo",
  v: "En V",
};

export const SLEEVE_LABELS: Record<SleeveKind, string> = {
  short: "Corta",
  long: "Larga",
  sleeveless: "Sin manga",
};

/**
 * Opciones expuestas en la UI.
 *
 * `sleeveless` queda fuera a propósito: sin manga que la tape, la sisa
 * necesita recortarse y ribetearse de verdad en la malla, y el muñón corto
 * que se usa como sustituto deja ver el interior de la prenda. El tipo se
 * mantiene para no romper diseños guardados cuando se implemente bien.
 */
export const SLEEVE_OPTIONS: SleeveKind[] = ["short", "long"];

export interface KitConstruction {
  collar: CollarKind;
  sleeve: SleeveKind;
  /**
   * Grosor de la cinta de cuello, como fracción de la altura de la pieza.
   * Sólo aplica a mallas cuyo cuello se pinta en la textura.
   */
  collarWidth?: number;
}

export const COLLAR_WIDTH_RANGE = { min: 0.012, max: 0.07, step: 0.002 };

import type { Layer } from "./layers";

export interface DesignState {
  schema: 1;
  meta: {
    name: string;
    clubName: string;
    kind: "HOME" | "AWAY" | "THIRD";
  };
  palette: PaletteEntry[];
  kit: {
    construction: KitConstruction;
    zones: Record<ZoneId, ZoneFill>;
  };
  /** Capas apiladas sobre el patrón base: escudo, sponsors, nombre, número. */
  layers: Layer[];
}

/** Resuelve una ColorRef contra la paleta del diseño. */
export function resolveColor(state: DesignState, ref: ColorRef): string {
  if (ref.startsWith("palette:")) {
    const i = Number(ref.slice("palette:".length));
    return state.palette[i]?.hex ?? "#FF00FF";
  }
  return ref;
}
