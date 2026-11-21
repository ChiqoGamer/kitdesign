"use client";

import { PALETTE_MAX, PALETTE_MIN, paletteIndexInUse } from "@core/index";
import { useEditor } from "../store";
import { PanelSection } from "@/src/components/ui";

/** Colores sugeridos al agregar: los que más aparecen en clubes. */
const SUGGESTED = ["#111111", "#F2C200", "#1E8F3E", "#6B1F7A", "#7CC4F2", "#E06A00"];

export function PalettePanel() {
  const design = useEditor((s) => s.design);
  const dispatch = useEditor((s) => s.dispatch);
  const palette = design.palette;
  const last = palette.length - 1;

  const add = () => {
    const used = new Set(palette.map((p) => p.hex.toUpperCase()));
    const hex = SUGGESTED.find((h) => !used.has(h)) ?? "#888888";
    dispatch({
      type: "ADD_PALETTE_COLOR",
      hex,
      name: `Color ${palette.length + 1}`,
    });
  };

  const lastRemovable =
    palette.length > PALETTE_MIN && !paletteIndexInUse(design, last);

  return (
    <PanelSection
      title="Colores del club"
      hint="Definí los colores una vez. Aparecen en todo el editor y las plantillas se muestran directamente con ellos."
    >
      {palette.map((entry, i) => (
        <div key={entry.id} className="group mb-3 flex items-center gap-3 last:mb-0">
          <input
            type="color"
            value={entry.hex}
            aria-label={`Color de ${entry.name}`}
            onChange={(e) =>
              dispatch({
                type: "SET_PALETTE_COLOR",
                index: i,
                hex: e.target.value.toUpperCase(),
              })
            }
            className="h-10 w-10 shrink-0"
          />
          <div className="min-w-0 flex-1">
            {/* El nombre se edita en el lugar: "Azul" no sirve si el club
                lo llama "Azul Boedo". */}
            <input
              value={entry.name}
              aria-label="Nombre del color"
              maxLength={24}
              onChange={(e) =>
                dispatch({ type: "RENAME_PALETTE_COLOR", index: i, name: e.target.value })
              }
              className="w-full rounded bg-transparent text-xs text-ink-100 outline-none focus:bg-ink-800 focus:px-1"
            />
            <input
              defaultValue={entry.hex}
              key={entry.hex}
              aria-label="Código hexadecimal"
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(v)) {
                  dispatch({ type: "SET_PALETTE_COLOR", index: i, hex: v });
                }
              }}
              className="w-full bg-transparent font-mono text-[11px] text-ink-400 outline-none focus:text-ink-100"
            />
          </div>
          {i === last && palette.length > PALETTE_MIN ? (
            <button
              onClick={() => dispatch({ type: "REMOVE_PALETTE_COLOR", index: i })}
              disabled={!lastRemovable}
              title={
                lastRemovable
                  ? "Quitar color"
                  : "Está en uso en el diseño: cambialo antes de quitarlo"
              }
              className="shrink-0 rounded p-1 text-ink-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-500"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" />
              </svg>
            </button>
          ) : null}
        </div>
      ))}

      {palette.length < PALETTE_MAX ? (
        <button
          onClick={add}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-ink-600 px-3 py-2 text-xs text-ink-300 transition-colors hover:border-ink-400 hover:text-ink-100"
        >
          <span aria-hidden="true">+</span> Agregar color
        </button>
      ) : (
        <p className="mt-3 text-[11px] text-ink-500">
          Hasta {PALETTE_MAX} colores: más que eso deja de ser una identidad.
        </p>
      )}
    </PanelSection>
  );
}
