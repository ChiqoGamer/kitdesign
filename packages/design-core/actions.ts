import type {
  ColorRef,
  DesignState,
  JerseyConstruction,
  PatternId,
  PatternParams,
  ZoneId,
} from "./types";

/**
 * Toda mutación del diseño es una de estas acciones.
 *
 * Este tipo es el contrato compartido entre:
 *   - la UI (un click en un panel despacha una acción)
 *   - la IA (el agente devuelve un array de estas acciones)
 *   - el historial (cada acción produce patches invertibles)
 *
 * Consecuencia: la IA no puede hacer nada que un usuario no pueda hacer,
 * y todo lo que hace la IA es deshacible con Cmd+Z sin código extra.
 */
export type Action =
  | { type: "SET_ZONE_PATTERN"; zone: ZoneId; pattern: PatternId }
  | { type: "SET_ZONE_COLOR"; zone: ZoneId; slot: 0 | 1 | 2; color: ColorRef }
  | {
      type: "SET_ZONE_PARAM";
      zone: ZoneId;
      key: keyof PatternParams;
      value: number;
    }
  | {
      type: "SET_CONSTRUCTION";
      key: keyof JerseyConstruction;
      value: JerseyConstruction[keyof JerseyConstruction];
    }
  | { type: "SET_PALETTE_COLOR"; index: number; hex: string }
  | { type: "SET_META"; key: keyof DesignState["meta"]; value: string }
  | { type: "LOAD_STATE"; state: DesignState };

export type ActionType = Action["type"];

/** Etiqueta legible para el historial y para la UI de deshacer. */
export function describeAction(action: Action): string {
  switch (action.type) {
    case "SET_ZONE_PATTERN":
      return `Patrón de ${action.zone}`;
    case "SET_ZONE_COLOR":
      return `Color de ${action.zone}`;
    case "SET_ZONE_PARAM":
      return `Ajuste de ${action.zone}`;
    case "SET_CONSTRUCTION":
      return `Cambio de ${action.key}`;
    case "SET_PALETTE_COLOR":
      return "Paleta del club";
    case "SET_META":
      return "Datos del diseño";
    case "LOAD_STATE":
      return "Cargar diseño";
  }
}
