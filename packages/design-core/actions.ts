import type {
  ColorRef,
  DesignState,
  KitConstruction,
  PatternId,
  PatternParams,
  ZoneId,
} from "./types";
import type { AnchorId, FontId, Layer } from "./layers";

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
  | { type: "TOGGLE_ZONE"; zone: ZoneId }
  | { type: "SET_ZONE_HIDDEN"; zone: ZoneId; hidden: boolean }
  | { type: "SET_ZONE_COLOR"; zone: ZoneId; slot: 0 | 1 | 2; color: ColorRef }
  | {
      type: "SET_ZONE_PARAM";
      zone: ZoneId;
      key: keyof PatternParams;
      value: number;
    }
  | {
      type: "SET_CONSTRUCTION";
      key: keyof KitConstruction;
      value: KitConstruction[keyof KitConstruction];
    }
  | { type: "SET_PALETTE_COLOR"; index: number; hex: string }
  | { type: "SET_META"; key: keyof DesignState["meta"]; value: string }
  | { type: "ADD_LAYER"; layer: Layer }
  | { type: "REMOVE_LAYER"; id: string }
  | { type: "TOGGLE_LAYER"; id: string }
  | { type: "REORDER_LAYER"; id: string; dir: -1 | 1 }
  | { type: "MOVE_LAYER"; id: string; offset: { x: number; y: number } }
  | { type: "SCALE_LAYER"; id: string; scale: number }
  | { type: "ROTATE_LAYER"; id: string; rotation: number }
  | { type: "SET_LAYER_ANCHOR"; id: string; anchor: AnchorId }
  | { type: "SET_LAYER_TEXT"; id: string; text: string }
  | { type: "SET_LAYER_COLOR"; id: string; slot: "color" | "outline"; color: ColorRef }
  | { type: "SET_LAYER_FONT"; id: string; font: FontId }
  | { type: "LOAD_STATE"; state: DesignState };

export type ActionType = Action["type"];

/** Etiqueta legible para el historial y para la UI de deshacer. */
export function describeAction(action: Action): string {
  switch (action.type) {
    case "SET_ZONE_PATTERN":
      return `Patrón de ${action.zone}`;
    case "TOGGLE_ZONE":
      return `Mostrar/ocultar ${action.zone}`;
    case "SET_ZONE_HIDDEN":
      return action.hidden ? "Quitar panel" : "Agregar panel";
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
    case "ADD_LAYER":
      return `Agregar ${action.layer.name}`;
    case "REMOVE_LAYER":
      return "Quitar capa";
    case "TOGGLE_LAYER":
      return "Mostrar/ocultar capa";
    case "REORDER_LAYER":
      return "Reordenar capa";
    case "MOVE_LAYER":
      return "Mover capa";
    case "SCALE_LAYER":
      return "Escalar capa";
    case "ROTATE_LAYER":
      return "Rotar capa";
    case "SET_LAYER_ANCHOR":
      return "Ubicación de capa";
    case "SET_LAYER_TEXT":
      return "Texto de capa";
    case "SET_LAYER_COLOR":
      return "Color de capa";
    case "SET_LAYER_FONT":
      return "Tipografía de capa";
    case "LOAD_STATE":
      return "Cargar diseño";
  }
}
