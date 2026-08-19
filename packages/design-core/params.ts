import type { PatternParams } from "./types";

/**
 * Rangos válidos de cada parámetro de patrón.
 * Se usan en tres lugares: los sliders de la UI, el clamp del reducer y el
 * JSON Schema que se le expone a la IA. Una sola definición evita que se
 * desincronicen.
 */
export const PARAM_RANGES: Record<
  keyof PatternParams,
  { min: number; max: number; step: number; label: string }
> = {
  count: { min: 1, max: 24, step: 1, label: "Cantidad" },
  width: { min: 0.05, max: 0.95, step: 0.01, label: "Grosor" },
  offset: { min: 0, max: 1, step: 0.01, label: "Desfasaje" },
  angle: { min: -75, max: 75, step: 1, label: "Inclinación" },
  position: { min: 0, max: 1, step: 0.01, label: "Posición" },
};

/** Qué parámetros muestra/usa cada patrón. El resto se ocultan en la UI. */
export const PATTERN_PARAM_KEYS: Record<string, (keyof PatternParams)[]> = {
  solid: [],
  stripesV: ["count", "width", "offset"],
  stripesH: ["count", "width", "offset"],
  halves: ["position"],
  sash: ["width", "angle", "position"],
  gradient: ["position"],
};

/** Cuántos colores usa realmente cada patrón (para no mostrar pickers de más). */
export const PATTERN_COLOR_COUNT: Record<string, number> = {
  solid: 1,
  stripesV: 2,
  stripesH: 2,
  halves: 2,
  sash: 2,
  gradient: 2,
};

export function clampParam(key: keyof PatternParams, value: number): number {
  const range = PARAM_RANGES[key];
  if (!Number.isFinite(value)) return range.min;
  return Math.min(range.max, Math.max(range.min, value));
}
