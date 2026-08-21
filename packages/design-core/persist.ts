import { createDefaultDesign } from "./defaults";
import type { DesignState } from "./types";

/**
 * PERSISTENCIA
 * ============
 * El DesignState es un JSON plano y versionado, así que guardarlo es
 * literalmente serializarlo. `schema` existe justamente para esto: permite
 * ignorar (o más adelante migrar) diseños guardados con una forma vieja en
 * vez de romper el editor con datos que ya no entiende.
 */

export const CURRENT_SCHEMA = 1;

export interface StoredDesign {
  schema: number;
  savedAt: string;
  design: DesignState;
}

export function serializeDesign(design: DesignState): string {
  const payload: StoredDesign = {
    schema: CURRENT_SCHEMA,
    savedAt: new Date().toISOString(),
    design,
  };
  return JSON.stringify(payload);
}

/**
 * Devuelve el diseño guardado, o null si el dato no sirve. Nunca lanza:
 * un guardado corrupto o de otra versión no debe impedir abrir el editor.
 */
export function parseDesign(raw: string | null): DesignState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDesign>;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.schema !== CURRENT_SCHEMA) return null;
    const design = parsed.design;
    if (!design || design.schema !== CURRENT_SCHEMA) return null;
    // Comprobaciones mínimas de forma: si falta algo estructural, se
    // descarta en vez de dejar el editor a medio armar.
    if (!design.kit?.zones || !design.palette || !Array.isArray(design.layers)) {
      return null;
    }
    return design;
  } catch {
    return null;
  }
}

/** Diseño de arranque: el guardado si es válido, si no uno nuevo. */
export function designFrom(raw: string | null): DesignState {
  return parseDesign(raw) ?? createDefaultDesign();
}
