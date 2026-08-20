"use client";

import {
  COLLAR_LABELS,
  SLEEVE_LABELS,
  SLEEVE_OPTIONS,
  type CollarKind,
  type SleeveKind,
} from "@core/index";
import { useEditor } from "../store";
import { PanelSection, SegmentedControl } from "@/src/components/ui";

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
