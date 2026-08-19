"use client";

import { useEffect, useRef } from "react";
import { TEMPLATES, type DesignState, type Template } from "@core/index";
import { PIECE_BY_ID } from "@geom/atlas";
import { createAtlasCanvas, renderDesign } from "@render/canvas";
import { useEditor } from "../store";
import { PanelSection } from "@/src/components/ui";

const THUMB_ATLAS = 512;

/**
 * Miniatura real de la plantilla, renderizada con el MISMO renderer que la
 * textura 3D y con la paleta del club aplicada.
 *
 * Que el usuario vea "su" camiseta antes de elegir es el momento de
 * enganche del onboarding, y sólo es posible porque las plantillas guardan
 * referencias a la paleta en vez de colores fijos.
 */
function TemplateThumb({
  design,
  template,
}: {
  design: DesignState;
  template: Template;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paletteKey = design.palette.map((p) => p.hex).join(",");

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const ctx = target.getContext("2d");
    if (!ctx) return;

    const off = createAtlasCanvas(THUMB_ATLAS);
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    renderDesign(offCtx, { ...design, jersey: template.build() }, THUMB_ATLAS);

    // Se recorta sólo el delantero del atlas.
    const r = PIECE_BY_ID.front.rect;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(
      off,
      r.x * THUMB_ATLAS,
      (1 - (r.y + r.h)) * THUMB_ATLAS,
      r.w * THUMB_ATLAS,
      r.h * THUMB_ATLAS,
      0,
      0,
      target.width,
      target.height,
    );
  }, [design, template, paletteKey]);

  return (
    <canvas
      ref={ref}
      width={120}
      height={150}
      className="h-full w-full rounded-md"
    />
  );
}

export function TemplatePanel() {
  const design = useEditor((s) => s.design);
  const applyTemplate = useEditor((s) => s.applyTemplate);

  return (
    <PanelSection
      title="Punto de partida"
      hint="Elegí una base y modificá todo lo que quieras después."
    >
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.slug}
            onClick={() => applyTemplate(t.slug)}
            className="overflow-hidden rounded-lg border-2 border-ink-700 transition-colors hover:border-ink-400"
          >
            <div className="h-24 w-full overflow-hidden bg-ink-800">
              <TemplateThumb design={design} template={t} />
            </div>
            <div className="bg-ink-800 px-2 py-1.5 text-left text-[11px] text-ink-300">
              {t.name}
            </div>
          </button>
        ))}
      </div>
    </PanelSection>
  );
}
