"use client";

import {
  COLLAR_LABELS,
  COLLAR_WIDTH_RANGE,
  SLEEVE_LABELS,
  SLEEVE_OPTIONS,
  type CollarKind,
  type SleeveKind,
} from "@core/index";
import { useEditor } from "../store";
import { PanelSection, SegmentedControl, Slider } from "@/src/components/ui";

export function ConstructionPanel() {
  const construction = useEditor((s) => s.design.kit.construction);
  const dispatch = useEditor((s) => s.dispatch);

  return (
    <>
      <PanelSection title="Cuello">
        <SegmentedControl<CollarKind>
          value={construction.collar}
          onChange={(value) =>
            dispatch({ type: "SET_CONSTRUCTION", key: "collar", value })
          }
          options={(Object.keys(COLLAR_LABELS) as CollarKind[]).map((k) => ({
            value: k,
            label: COLLAR_LABELS[k],
          }))}
        />
        <div className="mt-3">
          <Slider
            label="Grosor de la cinta"
            min={COLLAR_WIDTH_RANGE.min}
            max={COLLAR_WIDTH_RANGE.max}
            step={COLLAR_WIDTH_RANGE.step}
            value={construction.collarWidth ?? 0.028}
            format={(v) => `${(v * 100).toFixed(1)}`}
            onChange={(value) => dispatch({ type: "SET_COLLAR_WIDTH", value })}
          />
        </div>
      </PanelSection>

      <PanelSection title="Mangas">
        <SegmentedControl<SleeveKind>
          value={construction.sleeve}
          onChange={(value) =>
            dispatch({ type: "SET_CONSTRUCTION", key: "sleeve", value })
          }
          options={SLEEVE_OPTIONS.map((k) => ({
            value: k,
            label: SLEEVE_LABELS[k],
          }))}
        />
      </PanelSection>
    </>
  );
}
