"use client";

import {
  ANCHORS,
  FONT_LABELS,
  resolveColor,
  type AnchorId,
  type FontId,
  type Layer,
} from "@core/index";
import { useEditor } from "../store";
import { PanelSection, Slider } from "@/src/components/ui";

/** Anclajes disponibles para una capa, según su tipo. */
function anchorsFor(layer: Layer): AnchorId[] {
  const all = Object.keys(ANCHORS) as AnchorId[];
  if (layer.kind === "number") {
    return all.filter((a) => a === "backNumber" || a === "shortsNumber");
  }
  if (layer.kind === "text") {
    return all.filter((a) => a === "backName" || a === "chest");
  }
  return all; // logos van a cualquier lado
}

export function LayerEditor({ layerId }: { layerId: string }) {
  const layer = useEditor((s) =>
    s.design.layers.find((l) => l.id === layerId),
  );
  const palette = useEditor((s) => s.design.palette);
  const design = useEditor((s) => s.design);
  const dispatch = useEditor((s) => s.dispatch);

  if (!layer) return null;

  const swatches = (
    slot: "color" | "outline",
    current: string,
  ) => (
    <div className="flex items-center gap-1.5">
      {palette.map((entry, i) => {
        const ref = `palette:${i}`;
        const active = current === ref;
        return (
          <button
            key={entry.id}
            onClick={() =>
              dispatch({ type: "SET_LAYER_COLOR", id: layer.id, slot, color: ref })
            }
            style={{ background: entry.hex }}
            title={entry.name}
            className={`h-7 w-7 rounded-md border-2 transition-transform ${
              active ? "border-accent scale-105" : "border-ink-600 hover:scale-105"
            }`}
          />
        );
      })}
      <input
        type="color"
        value={resolveColor(design, current)}
        onChange={(e) =>
          dispatch({
            type: "SET_LAYER_COLOR",
            id: layer.id,
            slot,
            color: e.target.value.toUpperCase(),
          })
        }
        className="ml-auto h-7 w-7"
        title="Color libre"
      />
    </div>
  );

  return (
    <>
      {(layer.kind === "text" || layer.kind === "number") && (
        <PanelSection title={layer.kind === "text" ? "Texto" : "Número"}>
          <input
            value={layer.kind === "text" ? layer.text : layer.value}
            onChange={(e) =>
              dispatch({ type: "SET_LAYER_TEXT", id: layer.id, text: e.target.value })
            }
            maxLength={layer.kind === "number" ? 2 : 16}
            inputMode={layer.kind === "number" ? "numeric" : "text"}
            className="mb-3 w-full rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-50 outline-none focus:border-ink-400"
            placeholder={layer.kind === "number" ? "10" : "Nombre"}
          />
          <div className="mb-3">
            <div className="mb-1.5 text-xs text-ink-300">Tipografía</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(FONT_LABELS) as FontId[]).map((f) => (
                <button
                  key={f}
                  onClick={() => dispatch({ type: "SET_LAYER_FONT", id: layer.id, font: f })}
                  className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                    layer.font === f
                      ? "bg-ink-600 text-ink-50"
                      : "bg-ink-800 text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {FONT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-1.5 text-xs text-ink-300">Color</div>
          {swatches("color", layer.color)}
          {layer.kind === "number" && (
            <>
              <div className="mb-1.5 mt-3 text-xs text-ink-300">Contorno</div>
              {swatches("outline", layer.outline)}
            </>
          )}
        </PanelSection>
      )}

      <PanelSection title="Ubicación">
        <div className="grid grid-cols-1 gap-1.5">
          {anchorsFor(layer).map((a) => (
            <button
              key={a}
              onClick={() => dispatch({ type: "SET_LAYER_ANCHOR", id: layer.id, anchor: a })}
              className={`rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                layer.anchor === a
                  ? "bg-ink-600 text-ink-50"
                  : "bg-ink-800 text-ink-400 hover:text-ink-100"
              }`}
            >
              {ANCHORS[a].label}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Ajuste fino">
        <Slider
          label="Tamaño"
          min={0.15}
          max={4}
          step={0.01}
          value={layer.scale}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => dispatch({ type: "SCALE_LAYER", id: layer.id, scale: v })}
        />
        <Slider
          label="Horizontal"
          min={-0.25}
          max={0.25}
          step={0.005}
          value={layer.offset.x}
          format={(v) => `${(v * 100).toFixed(0)}`}
          onChange={(v) =>
            dispatch({ type: "MOVE_LAYER", id: layer.id, offset: { x: v, y: layer.offset.y } })
          }
        />
        <Slider
          label="Vertical"
          min={-0.25}
          max={0.25}
          step={0.005}
          value={layer.offset.y}
          format={(v) => `${(v * 100).toFixed(0)}`}
          onChange={(v) =>
            dispatch({ type: "MOVE_LAYER", id: layer.id, offset: { x: layer.offset.x, y: v } })
          }
        />
        <Slider
          label="Rotación"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          format={(v) => `${Math.round(v)}°`}
          onChange={(v) => dispatch({ type: "ROTATE_LAYER", id: layer.id, rotation: v })}
        />
      </PanelSection>
    </>
  );
}
