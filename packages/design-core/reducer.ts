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
          draft.jersey.zones[action.zone].pattern = action.pattern;
          break;
        }
        case "SET_ZONE_COLOR": {
          draft.jersey.zones[action.zone].colors[action.slot] = action.color;
          break;
        }
        case "SET_ZONE_PARAM": {
          const params = draft.jersey.zones[action.zone].params;
          params[action.key] = clampParam(action.key, action.value);
          break;
        }
        case "SET_CONSTRUCTION": {
          // El cast es seguro: la union de Action ya restringe key/value.
          (draft.jersey.construction[action.key] as string) = action.value;
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
        case "LOAD_STATE": {
          return action.state;
        }
      }
    },
  );
  return { state: next, patches, inverse };
}

export type { Patch };
