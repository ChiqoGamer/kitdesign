"use client";

import { useRef } from "react";
import {
  ANCHORS,
  createLogoLayer,
  createNumberLayer,
  createTextLayer,
  layerGarment,
  type AnchorId,
  type Layer,
} from "@core/index";
import { useEditor } from "../store";
import { PanelSection } from "@/src/components/ui";
import { LayerEditor } from "./LayerEditor";

const ADD_BUTTONS: {
  label: string;
  icon: string;
  make: () => Layer | "upload";
  anchor?: AnchorId;
}[] = [
  { label: "Escudo", icon: "M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z", make: () => "upload", anchor: "crest" },
  { label: "Sponsor", icon: "M4 7h16v10H4z M4 11h16", make: () => "upload", anchor: "chest" },
  { label: "Nombre", icon: "M5 7h14M5 12h14M5 17h9", make: () => createTextLayer("JUGADOR") },
  { label: "Número", icon: "M9 7h4v10M9 17h6", make: () => createNumberLayer("10") },
];

export function LayersPanel() {
  const layers = useEditor((s) => s.design.layers);
  const dispatch = useEditor((s) => s.dispatch);
  const addLayer = useEditor((s) => s.addLayer);
  const selectedId = useEditor((s) => s.selectedLayerId);
  const selectLayer = useEditor((s) => s.selectLayer);

  const fileInput = useRef<HTMLInputElement>(null);
  const pendingAnchor = useRef<AnchorId>("crest");

  const handleAdd = (btn: (typeof ADD_BUTTONS)[number]) => {
    const result = btn.make();
    if (result === "upload") {
      pendingAnchor.current = btn.anchor ?? "crest";
      fileInput.current?.click();
      return;
    }
    addLayer(result);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const isCrest = pendingAnchor.current === "crest";
      addLayer(
        createLogoLayer(
          src,
          pendingAnchor.current,
          isCrest ? "Escudo" : "Sponsor",
        ),
      );
    };
    reader.readAsDataURL(file);
  };

  // Se muestran de arriba (frente) hacia abajo, como en un editor de capas:
  // el último del array es el que está más arriba en el apilado.
  const ordered = [...layers].reverse();

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        onChange={handleFile}
        className="hidden"
      />

      <PanelSection title="Agregar capa">
        <div className="grid grid-cols-2 gap-2">
          {ADD_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              onClick={() => handleAdd(btn)}
              className="flex items-center gap-2 rounded-md border border-ink-700 px-3 py-2.5 text-[13px] text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-800"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={btn.icon} />
              </svg>
              {btn.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Escudo y sponsor aceptan PNG, JPG o SVG.
        </p>
      </PanelSection>

      <PanelSection title={`Capas (${layers.length})`}>
        {layers.length === 0 ? (
          <p className="text-xs text-ink-500">
            Todavía no agregaste capas. Subí el escudo de tu club para empezar.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ordered.map((layer) => (
              <li key={layer.id}>
                <div
                  onClick={() => selectLayer(layer.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                    selectedId === layer.id
                      ? "bg-ink-700 text-ink-50"
                      : "text-ink-300 hover:bg-ink-800"
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: "TOGGLE_LAYER", id: layer.id });
                    }}
                    className="text-ink-400 hover:text-ink-100"
                    title={layer.visible ? "Ocultar" : "Mostrar"}
                  >
                    {layer.visible ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.5" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.4 3.4M9.9 5.2A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-2.6 3.4M6.1 6.1A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 004-.9" /></svg>
                    )}
                  </button>

                  <span className="min-w-0 flex-1 truncate">{layerLabel(layer)}</span>

                  <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "REORDER_LAYER", id: layer.id, dir: 1 });
                      }}
                      className="px-1 text-ink-400 hover:text-ink-100"
                      title="Subir"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 15l6-6 6 6" /></svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "REORDER_LAYER", id: layer.id, dir: -1 });
                      }}
                      className="px-1 text-ink-400 hover:text-ink-100"
                      title="Bajar"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedId === layer.id) selectLayer(null);
                        dispatch({ type: "REMOVE_LAYER", id: layer.id });
                      }}
                      className="px-1 text-ink-400 hover:text-red-400"
                      title="Borrar"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" /></svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      {selectedId ? <LayerEditor layerId={selectedId} /> : null}
    </>
  );
}

function layerLabel(layer: Layer): string {
  const where = ANCHORS[layer.anchor].label;
  if (layer.kind === "text") return `“${layer.text}” · ${where}`;
  if (layer.kind === "number") return `Nº ${layer.value} · ${where}`;
  return `${layer.name} · ${where}`;
}
