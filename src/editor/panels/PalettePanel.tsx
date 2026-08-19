"use client";

import { useEditor } from "../store";
import { PanelSection } from "@/src/components/ui";

export function PalettePanel() {
  const design = useEditor((s) => s.design);
  const dispatch = useEditor((s) => s.dispatch);

  return (
    <PanelSection
      title="Identidad del club"
      hint="Definí los colores una vez. Aparecen en todo el editor y las plantillas se muestran directamente con ellos."
    >
      {design.palette.map((entry, i) => (
        <div key={entry.id} className="mb-3 flex items-center gap-3 last:mb-0">
          <input
            type="color"
            value={entry.hex}
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
            <div className="truncate text-xs text-ink-200">{entry.name}</div>
            <input
              value={entry.hex}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(v)) {
                  dispatch({ type: "SET_PALETTE_COLOR", index: i, hex: v });
                }
              }}
              className="w-full bg-transparent font-mono text-[11px] text-ink-400 outline-none focus:text-ink-100"
            />
          </div>
        </div>
      ))}
    </PanelSection>
  );
}
