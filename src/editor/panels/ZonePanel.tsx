"use client";

import {
  PATTERN_COLOR_COUNT,
  PATTERN_LABELS,
  PATTERN_PARAM_KEYS,
  PARAM_RANGES,
  ZONE_IDS,
  ZONE_LABELS,
  resolveColor,
  type PatternId,
  type PatternParams,
} from "@core/index";
import { useEditor } from "../store";
import { PanelSection, Slider } from "@/src/components/ui";
import { patternPreviewStyle } from "./patternPreview";

const SLOT_LABELS = ["Color base", "Color secundario", "Color terciario"];

export function ZonePanel() {
  const design = useEditor((s) => s.design);
  const zone = useEditor((s) => s.selectedZone);
  const selectZone = useEditor((s) => s.selectZone);
  const dispatch = useEditor((s) => s.dispatch);

  const fill = design.kit.zones[zone];
  const resolved = fill.colors.map((c: string) => resolveColor(design, c));
  const colorCount = PATTERN_COLOR_COUNT[fill.pattern] ?? 1;
  const paramKeys = PATTERN_PARAM_KEYS[fill.pattern] ?? [];

  return (
    <>
      <div className="flex gap-1 border-b border-ink-700 px-4 py-3">
        {ZONE_IDS.map((z) => (
          <button
            key={z}
            onClick={() => selectZone(z)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              zone === z
                ? "bg-ink-600 text-ink-50"
                : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            {ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      <PanelSection title="Patrón">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PATTERN_LABELS) as PatternId[]).map((p) => (
            <button
              key={p}
              onClick={() =>
                dispatch({ type: "SET_ZONE_PATTERN", zone, pattern: p })
              }
              title={PATTERN_LABELS[p]}
              className={`group overflow-hidden rounded-lg border-2 transition-colors ${
                fill.pattern === p
                  ? "border-accent"
                  : "border-ink-700 hover:border-ink-500"
              }`}
            >
              <div
                className="h-11 w-full"
                style={patternPreviewStyle(p, resolved)}
              />
              <div className="truncate bg-ink-800 px-1 py-1 text-[10px] text-ink-400">
                {PATTERN_LABELS[p]}
              </div>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Colores">
        {Array.from({ length: colorCount }).map((_, slot) => (
          <div key={slot} className="mb-4 last:mb-0">
            <div className="mb-1.5 text-xs text-ink-300">
              {SLOT_LABELS[slot]}
            </div>
            <div className="flex items-center gap-1.5">
              {/* La paleta del club va primero y ocupa el lugar principal:
                  es lo que mantiene el diseño dentro de la identidad. */}
              {design.palette.map((entry, i) => {
                const ref = `palette:${i}`;
                const active = fill.colors[slot] === ref;
                return (
                  <button
                    key={entry.id}
                    onClick={() =>
                      dispatch({
                        type: "SET_ZONE_COLOR",
                        zone,
                        slot: slot as 0 | 1 | 2,
                        color: ref,
                      })
                    }
                    title={entry.name}
                    style={{ background: entry.hex }}
                    className={`h-8 w-8 rounded-md border-2 transition-transform ${
                      active
                        ? "border-accent scale-105"
                        : "border-ink-600 hover:scale-105"
                    }`}
                  />
                );
              })}
              <div className="ml-auto flex items-center gap-1.5">
                <input
                  type="color"
                  value={resolved[slot]}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_ZONE_COLOR",
                      zone,
                      slot: slot as 0 | 1 | 2,
                      color: e.target.value.toUpperCase(),
                    })
                  }
                  className="h-8 w-8"
                  title="Color libre"
                />
              </div>
            </div>
          </div>
        ))}
      </PanelSection>

      {paramKeys.length > 0 ? (
        <PanelSection title="Ajustes">
          {paramKeys.map((key) => {
            const range = PARAM_RANGES[key as keyof PatternParams];
            return (
              <Slider
                key={key}
                label={range.label}
                min={range.min}
                max={range.max}
                step={range.step}
                value={fill.params[key as keyof PatternParams]}
                format={(v) =>
                  range.step < 1 ? v.toFixed(2) : String(Math.round(v))
                }
                onChange={(value) =>
                  dispatch({
                    type: "SET_ZONE_PARAM",
                    zone,
                    key: key as keyof PatternParams,
                    value,
                  })
                }
              />
            );
          })}
        </PanelSection>
      ) : null}
    </>
  );
}
