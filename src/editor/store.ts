"use client";

import { applyPatches } from "immer";
import { create } from "zustand";
import {
  applyAction,
  createDefaultDesign,
  describeAction,
  ZONE_GARMENT,
  type Action,
  type DesignState,
  type GarmentId,
  type Patch,
  type ZoneId,
} from "@core/index";
import { TEMPLATES } from "@core/defaults";

interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  label: string;
  /** Acciones consecutivas con la misma clave se fusionan (arrastrar un slider). */
  coalesceKey: string | null;
  at: number;
}

const COALESCE_MS = 700;

function coalesceKeyOf(action: Action): string | null {
  switch (action.type) {
    case "SET_ZONE_PARAM":
      return `param:${action.zone}:${action.key}`;
    case "SET_PALETTE_COLOR":
      return `palette:${action.index}`;
    case "SET_ZONE_COLOR":
      return `color:${action.zone}:${action.slot}`;
    default:
      return null;
  }
}

interface EditorStore {
  design: DesignState;
  /** Contador que invalida la textura sin comparar el estado en profundidad. */
  revision: number;
  past: HistoryEntry[];
  future: HistoryEntry[];
  selectedZone: ZoneId;
  section: string;
  /** Qué se muestra/encuadra en el visor: una prenda o el kit completo. */
  focus: GarmentId | "all";

  dispatch: (action: Action) => void;
  undo: () => void;
  redo: () => void;
  selectZone: (zone: ZoneId) => void;
  setSection: (section: string) => void;
  setFocus: (focus: GarmentId | "all") => void;
  applyTemplate: (slug: string) => void;
}

export const useEditor = create<EditorStore>((set, get) => ({
  design: createDefaultDesign(),
  revision: 0,
  past: [],
  future: [],
  selectedZone: "body",
  section: "zonas",
  focus: "all",

  dispatch(action) {
    const { design, past } = get();
    const { state, patches, inverse } = applyAction(design, action);
    if (patches.length === 0) return;

    const key = coalesceKeyOf(action);
    const last = past[past.length - 1];
    const now = Date.now();
    const canMerge =
      key !== null &&
      last?.coalesceKey === key &&
      now - last.at < COALESCE_MS;

    const entry: HistoryEntry = {
      // Al fusionar se conserva el inverso *original*: deshacer vuelve al
      // estado previo a todo el arrastre, no a un paso intermedio.
      inverse: canMerge ? last.inverse : inverse,
      patches,
      label: describeAction(action),
      coalesceKey: key,
      at: now,
    };

    set({
      design: state,
      revision: get().revision + 1,
      past: canMerge ? [...past.slice(0, -1), entry] : [...past, entry],
      future: [],
    });
  },

  undo() {
    const { past, future, design } = get();
    const entry = past[past.length - 1];
    if (!entry) return;
    set({
      design: applyPatches(design, entry.inverse),
      revision: get().revision + 1,
      past: past.slice(0, -1),
      future: [entry, ...future],
    });
  },

  redo() {
    const { past, future, design } = get();
    const entry = future[0];
    if (!entry) return;
    set({
      design: applyPatches(design, entry.patches),
      revision: get().revision + 1,
      past: [...past, entry],
      future: future.slice(1),
    });
  },

  selectZone(zone) {
    // Si el visor está enfocado en una prenda y se elige una zona de otra,
    // el foco sigue a la zona: nunca se edita algo que no se ve.
    const { focus } = get();
    const garment = ZONE_GARMENT[zone];
    set({
      selectedZone: zone,
      section: "zonas",
      focus: focus === "all" || focus === garment ? focus : garment,
    });
  },
  setSection: (section) => set({ section }),
  setFocus: (focus) => set({ focus }),

  applyTemplate(slug) {
    const template = TEMPLATES.find((t) => t.slug === slug);
    if (!template) return;
    const { design } = get();
    // La plantilla sólo trae referencias a la paleta, así que se muestra
    // automáticamente con los colores del club.
    get().dispatch({
      type: "LOAD_STATE",
      state: { ...design, kit: template.build() },
    });
  },
}));
