"use client";

import { applyPatches } from "immer";
import { create } from "zustand";
import {
  applyAction,
  parseDesign,
  serializeDesign,
  createDefaultDesign,
  describeAction,
  layerGarment,
  ZONE_GARMENT,
  type Action,
  type DesignState,
  type GarmentId,
  type Layer,
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

const STORAGE_KEY = "kitdesign:project:v1";

function coalesceKeyOf(action: Action): string | null {
  switch (action.type) {
    case "SET_ZONE_PARAM":
      return `param:${action.zone}:${action.key}`;
    case "SET_PALETTE_COLOR":
      return `palette:${action.index}`;
    case "SET_ZONE_COLOR":
      return `color:${action.zone}:${action.slot}`;
    case "MOVE_LAYER":
      return `move:${action.id}`;
    case "SCALE_LAYER":
      return `scale:${action.id}`;
    case "ROTATE_LAYER":
      return `rotate:${action.id}`;
    case "SET_LAYER_TEXT":
      return `text:${action.id}`;
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
  /** Capa seleccionada para editar sus propiedades. */
  selectedLayerId: string | null;
  /** Estado del guardado, para dar feedback en la barra superior. */
  saveState: "limpio" | "pendiente" | "guardando" | "guardado";
  lastSavedAt: string | null;

  dispatch: (action: Action) => void;
  undo: () => void;
  redo: () => void;
  selectZone: (zone: ZoneId) => void;
  setSection: (section: string) => void;
  setFocus: (focus: GarmentId | "all") => void;
  selectLayer: (id: string | null) => void;
  /** Guarda ahora mismo en el navegador. */
  save: () => void;
  /** Carga el diseño guardado, si hay uno válido. */
  restore: () => void;
  /** Agrega una capa y la deja seleccionada, enfocando su prenda. */
  addLayer: (layer: Layer) => void;
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
  selectedLayerId: null,
  saveState: "limpio",
  lastSavedAt: null,

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
      saveState: "pendiente",
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
  selectLayer: (id) => set({ selectedLayerId: id }),

  save() {
    if (typeof window === "undefined") return;
    set({ saveState: "guardando" });
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeDesign(get().design));
      set({ saveState: "guardado", lastSavedAt: new Date().toISOString() });
    } catch {
      // Cuota llena (los logos son dataURL y pesan): no se pierde el
      // diseño en pantalla, sólo no queda persistido.
      set({ saveState: "pendiente" });
    }
  },

  restore() {
    if (typeof window === "undefined") return;
    const design = parseDesign(window.localStorage.getItem(STORAGE_KEY));
    if (!design) return;
    set({
      design,
      revision: get().revision + 1,
      past: [],
      future: [],
      saveState: "guardado",
    });
  },
  addLayer(layer) {
    get().dispatch({ type: "ADD_LAYER", layer });
    set({ selectedLayerId: layer.id, focus: layerGarment(layer) });
  },

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

// Dev: acceso al store desde la consola para pruebas (inyectar capas, etc.).
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __editor?: unknown }).__editor = useEditor;
}
