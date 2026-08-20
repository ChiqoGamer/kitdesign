"use client";

import { useEffect, useRef } from "react";
import type { DesignState, GarmentId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { GARMENT_LABELS } from "@core/types";
import { renderGarment } from "@render/canvas";

/**
 * Vista "Textura": el atlas de patrón de cada prenda, en plano.
 *
 * No es una feature decorativa — este canvas ES el archivo que va a la
 * sublimadora (a otra resolución), así que lo que se ve acá es exactamente
 * lo que se fabrica. Sale gratis del atlas-como-patrón.
 */
function GarmentCanvas({
  design,
  revision,
  garment,
}: {
  design: DesignState;
  revision: number;
  garment: GarmentId;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const atlas = GARMENT_ATLASES[garment];
    const size = atlas.size;

    renderGarment(ctx, design, garment);

    // Fuera de los moldes: se atenúa. El fondo del atlas existe sólo para
    // tapar fugas de filtrado; en la vista de corte confunde.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);
    for (const piece of atlas.pieces) {
      const { x, y, w, h } = piece.rect;
      ctx.rect(x * size, (1 - (y + h)) * size, w * size, h * size);
    }
    ctx.fillStyle = "rgba(11, 13, 16, 0.88)";
    ctx.fill("evenodd");
    ctx.restore();

    // Contorno y nombre de cada molde, como en un layout de corte.
    for (const piece of atlas.pieces) {
      const x = piece.rect.x * size;
      const y = (1 - (piece.rect.y + piece.rect.h)) * size;
      const w = piece.rect.w * size;
      const h = piece.rect.h * size;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.font = `600 ${Math.round(size * 0.022)}px system-ui, sans-serif`;
      const label = piece.label.toUpperCase();
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(11,13,16,0.75)";
      ctx.fillRect(x + 8, y + h - size * 0.045, tw + 16, size * 0.034);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(label, x + 16, y + h - size * 0.021);
    }
  }, [design, revision, garment]);

  const size = GARMENT_ATLASES[garment].size;

  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <canvas
        ref={ref}
        width={size}
        height={size}
        className="aspect-square w-full max-w-[420px] rounded-lg border border-ink-700 bg-ink-800"
      />
      <figcaption className="text-[11px] uppercase tracking-[0.13em] text-ink-500">
        {GARMENT_LABELS[garment]}
      </figcaption>
    </figure>
  );
}

export function TextureView({
  design,
  revision,
}: {
  design: DesignState;
  revision: number;
}) {
  return (
    <div className="flex h-full items-center justify-center gap-6 overflow-auto p-8">
      <div className="w-[42%] min-w-0">
        <GarmentCanvas design={design} revision={revision} garment="jersey" />
      </div>
      <div className="flex w-[27%] min-w-0 flex-col gap-6">
        <GarmentCanvas design={design} revision={revision} garment="shorts" />
      </div>
      <div className="flex w-[27%] min-w-0 flex-col gap-6">
        <GarmentCanvas design={design} revision={revision} garment="socks" />
      </div>
    </div>
  );
}
