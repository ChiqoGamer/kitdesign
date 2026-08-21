import type { ColorRef, GarmentId } from "./types";

/**
 * SISTEMA DE CAPAS
 * ================
 * Sobre el patrón base de cada zona se apilan capas: escudo, sponsors,
 * nombre y número. Es lo que transforma "una camiseta rayada" en "la
 * camiseta de MI club".
 *
 * Una capa se ancla a un punto conocido de la prenda (pecho, espalda,
 * manga…) y guarda un desplazamiento, escala y rotación relativos. El
 * anclaje da la posición por defecto correcta; el resto es ajuste fino.
 * Esto es lo mismo que hace fabricable el resultado: el sponsor no está en
 * "un pixel cualquiera", está en "pecho, +2cm".
 */

export type LayerKind = "logo" | "text" | "number";

/** Puntos de anclaje: posición por defecto en UV del atlas (Y hacia arriba). */
export type AnchorId =
  | "crest"
  | "chest"
  | "sleeveR"
  | "sleeveL"
  | "backName"
  | "backNumber"
  | "shortsNumber";

export interface Anchor {
  id: AnchorId;
  garment: GarmentId;
  label: string;
  /** Punto por defecto en UV del atlas. */
  uv: { x: number; y: number };
  /** Tamaño base de la capa como fracción del lado del atlas. */
  baseSize: number;
  /**
   * Invierte el dibujo en horizontal al pintarlo en el atlas.
   *
   * Ojo con esto: el remapeo del torso YA invierte la coordenada u de la
   * espalda, así que el rectángulo de la espalda cae derecho en pantalla
   * para quien la mira. Poner `mirror` acá agregaba un segundo espejado y
   * el nombre y el número salían al revés. Sólo se usa donde la pieza en sí
   * queda invertida.
   */
  mirror: boolean;
  /** Posición en la vista plana 2D: qué cara y coords normalizadas (0..1). */
  flat: { side: "front" | "back"; x: number; y: number };
}

export const ANCHORS: Record<AnchorId, Anchor> = {
  crest: {
    id: "crest",
    garment: "jersey",
    label: "Escudo (pecho izq.)",
    uv: { x: 0.13, y: 0.84 },
    baseSize: 0.1,
    mirror: false,
    flat: { side: "front", x: 0.62, y: 0.30 },
  },
  chest: {
    id: "chest",
    garment: "jersey",
    label: "Sponsor (pecho)",
    uv: { x: 0.195, y: 0.72 },
    baseSize: 0.16,
    mirror: false,
    flat: { side: "front", x: 0.5, y: 0.42 },
  },
  sleeveR: {
    id: "sleeveR",
    garment: "jersey",
    label: "Manga derecha",
    uv: { x: 0.8775, y: 0.8 },
    baseSize: 0.11,
    mirror: false,
    flat: { side: "front", x: 0.85, y: 0.26 },
  },
  sleeveL: {
    id: "sleeveL",
    garment: "jersey",
    label: "Manga izquierda",
    uv: { x: 0.8775, y: 0.45 },
    baseSize: 0.11,
    mirror: true,
    flat: { side: "front", x: 0.15, y: 0.26 },
  },
  backName: {
    id: "backName",
    garment: "jersey",
    label: "Nombre (espalda)",
    uv: { x: 0.57, y: 0.88 },
    baseSize: 0.075,
    mirror: false,
    flat: { side: "back", x: 0.5, y: 0.26 },
  },
  backNumber: {
    id: "backNumber",
    garment: "jersey",
    label: "Número (espalda)",
    uv: { x: 0.57, y: 0.68 },
    baseSize: 0.17,
    mirror: false,
    flat: { side: "back", x: 0.5, y: 0.46 },
  },
  shortsNumber: {
    id: "shortsNumber",
    garment: "shorts",
    label: "Número (short)",
    uv: { x: 0.27, y: 0.6 },
    baseSize: 0.16,
    mirror: false,
    flat: { side: "front", x: 0.34, y: 0.42 },
  },
};

/** Tipografías disponibles para nombre y número. */
export type FontId = "classic" | "impact" | "serif" | "rounded";

export const FONT_LABELS: Record<FontId, string> = {
  classic: "Clásico",
  impact: "Impacto",
  serif: "Serif",
  rounded: "Redondeado",
};

export const FONT_STACKS: Record<FontId, string> = {
  classic: '"Arial Black", "Helvetica Neue", sans-serif',
  impact: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif',
};

interface LayerBase {
  id: string;
  kind: LayerKind;
  /** Nombre en la lista de capas. */
  name: string;
  anchor: AnchorId;
  /** Nudge respecto del anclaje, en fracción del atlas. */
  offset: { x: number; y: number };
  scale: number;
  /** Rotación en grados. */
  rotation: number;
  visible: boolean;
}

export interface LogoLayer extends LayerBase {
  kind: "logo";
  /** dataURL de la imagen subida (PNG/JPG/SVG). */
  src: string;
}

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  color: ColorRef;
  font: FontId;
}

export interface NumberLayer extends LayerBase {
  kind: "number";
  value: string;
  color: ColorRef;
  outline: ColorRef;
  font: FontId;
}

export type Layer = LogoLayer | TextLayer | NumberLayer;

/** La prenda a la que pertenece una capa se deriva de su anclaje. */
export function layerGarment(layer: Layer): GarmentId {
  return ANCHORS[layer.anchor].garment;
}

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

const ZERO = { x: 0, y: 0 };

export function createLogoLayer(
  src: string,
  anchor: AnchorId,
  name: string,
): LogoLayer {
  return {
    id: nextId("logo"),
    kind: "logo",
    name,
    anchor,
    offset: { ...ZERO },
    scale: 1,
    rotation: 0,
    visible: true,
    src,
  };
}

export function createTextLayer(text: string): TextLayer {
  return {
    id: nextId("text"),
    kind: "text",
    name: "Nombre",
    anchor: "backName",
    offset: { ...ZERO },
    scale: 1,
    rotation: 0,
    visible: true,
    text,
    color: "palette:1",
    font: "classic",
  };
}

export function createNumberLayer(value: string): NumberLayer {
  return {
    id: nextId("number"),
    kind: "number",
    name: "Número",
    anchor: "backNumber",
    offset: { ...ZERO },
    scale: 1,
    rotation: 0,
    visible: true,
    value,
    color: "palette:1",
    outline: "palette:0",
    font: "classic",
  };
}
