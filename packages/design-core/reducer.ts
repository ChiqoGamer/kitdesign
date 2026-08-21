import { enablePatches, produceWithPatches, type Patch } from "immer";
import type { Action } from "./actions";
import { clampParam } from "./params";
import type { DesignState } from "./types";

enablePatches();

export interface ApplyResult {
  state: DesignState;
  patches: Patch[];
  inverse: Patch[];
}

/**
 * Aplica una acción y devuelve el nuevo estado junto con los patches
 * directos e inversos. Los inversos son el historial de deshacer; los
 * directos son lo que se persiste como versión en la base de datos.
 */
export function applyAction(state: DesignState, action: Action): ApplyResult {
  const [next, patches, inverse] = produceWithPatches(
    state,
    (draft: DesignState) => {
      switch (action.type) {
        case "SET_ZONE_PATTERN": {
          draft.kit.zones[action.zone].pattern = action.pattern;
          break;
        }
        case "SET_COLLAR_WIDTH": {
          draft.kit.construction.collarWidth = Math.min(
            0.07,
            Math.max(0.012, action.value),
          );
          break;
        }
        case "TOGGLE_ZONE": {
          const z = draft.kit.zones[action.zone];
          z.hidden = !z.hidden;
          break;
        }
        case "SET_ZONE_HIDDEN": {
          draft.kit.zones[action.zone].hidden = action.hidden;
          break;
        }
        case "SET_ZONE_COLOR": {
          draft.kit.zones[action.zone].colors[action.slot] = action.color;
          break;
        }
        case "SET_ZONE_PARAM": {
          const params = draft.kit.zones[action.zone].params;
          params[action.key] = clampParam(action.key, action.value);
          break;
        }
        case "SET_CONSTRUCTION": {
          if (action.key === "collar") draft.kit.construction.collar = action.value;
          else draft.kit.construction.sleeve = action.value;
          break;
        }
        case "SET_PALETTE_COLOR": {
          const entry = draft.palette[action.index];
          if (entry) entry.hex = action.hex;
          break;
        }
        case "SET_META": {
          draft.meta[action.key] = action.value as never;
          break;
        }
        case "ADD_LAYER": {
          draft.layers.push(action.layer);
          break;
        }
        case "REMOVE_LAYER": {
          const i = draft.layers.findIndex((l) => l.id === action.id);
          if (i >= 0) draft.layers.splice(i, 1);
          break;
        }
        case "TOGGLE_LAYER": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l) l.visible = !l.visible;
          break;
        }
        case "REORDER_LAYER": {
          const i = draft.layers.findIndex((l) => l.id === action.id);
          const j = i + action.dir;
          if (i >= 0 && j >= 0 && j < draft.layers.length) {
            const [l] = draft.layers.splice(i, 1);
            draft.layers.splice(j, 0, l);
          }
          break;
        }
        case "MOVE_LAYER": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l) l.offset = action.offset;
          break;
        }
        case "SCALE_LAYER": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l) l.scale = Math.min(4, Math.max(0.15, action.scale));
          break;
        }
        case "ROTATE_LAYER": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l) l.rotation = action.rotation;
          break;
        }
        case "SET_LAYER_ANCHOR": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l) {
            l.anchor = action.anchor;
            l.offset = { x: 0, y: 0 };
          }
          break;
        }
        case "SET_LAYER_TEXT": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l && l.kind === "text") l.text = action.text;
          else if (l && l.kind === "number") l.value = action.text;
          break;
        }
        case "SET_LAYER_COLOR": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l && l.kind === "text") l.color = action.color;
          else if (l && l.kind === "number") {
            if (action.slot === "outline") l.outline = action.color;
            else l.color = action.color;
          }
          break;
        }
        case "SET_LAYER_FONT": {
          const l = draft.layers.find((l) => l.id === action.id);
          if (l && (l.kind === "text" || l.kind === "number")) l.font = action.font;
          break;
        }
        case "LOAD_STATE": {
          return action.state;
        }
      }
    },
  );
  return { state: next, patches, inverse };
}

export type { Patch };
