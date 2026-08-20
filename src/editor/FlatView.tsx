"use client";

import { useEffect, useRef } from "react";
import type { DesignState } from "@core/index";
import { renderFlatJersey } from "@render/flat";
import { onImagesReady } from "@render/images";

/**
 * Vista 2D: la camiseta de frente y espalda como ilustración plana.
 * Es la forma más clara de revisar el diseño e ir marcando ajustes.
 */
function FlatCanvas({
  design,
  revision,
  side,
  label,
}: {
  design: DesignState;
  revision: number;
  side: "front" | "back";
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pad = canvas.width * 0.06;
      renderFlatJersey(ctx, design, side, {
        x: pad,
        y: pad,
        w: canvas.width - pad * 2,
        h: canvas.height - pad * 2,
      });
    };
    draw();
    // Redibuja cuando cargan imágenes de capas (escudos/sponsors).
    return onImagesReady(draw);
  }, [design, revision, side]);

  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      <canvas
        ref={ref}
        width={620}
        height={720}
        className="w-full max-w-[520px] rounded-xl border border-ink-700 bg-ink-850"
      />
      <figcaption className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {label}
      </figcaption>
    </figure>
  );
}

export function FlatView({
  design,
  revision,
}: {
  design: DesignState;
  revision: number;
}) {
  return (
    <div className="flex h-full flex-col items-center gap-8 overflow-auto p-8">
      <FlatCanvas design={design} revision={revision} side="front" label="Frente" />
      <FlatCanvas design={design} revision={revision} side="back" label="Espalda" />
    </div>
  );
}
