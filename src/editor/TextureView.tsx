"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignState, GarmentId } from "@core/index";
import { GARMENT_ATLASES } from "@geom/atlas";
import { GARMENT_LABELS } from "@core/types";
import { renderGarment } from "@render/canvas";
import { onImagesReady } from "@render/images";
import { renderReferenceTemplate } from "@render/referenceTemplate";
import { renderPieceOutlines } from "@render/pieceGuide";
import {
  loadRefSilhouettes,
  type Silhouettes,
} from "@/src/three/refSilhouettes";

/**
 * Vista "Textura": el diseño en plano, tal como se reparte sobre la prenda.
 *
 * No es decorativa — este canvas ES el archivo que va a la sublimadora (a
 * otra resolución), así que lo que se ve acá es lo que se fabrica.
 *
 * La camiseta se muestra en el layout del modelo, el mismo que espera
 * "Importar textura", para que descargar la plantilla, pintarla afuera y
 * volver a subirla cierre el círculo. El short y las medias no tienen layout
 * importable, así que siguen mostrando su atlas.
 *
 * Las guías van en un canvas aparte, encima. Si se dibujaran sobre el mismo
 * canvas, la plantilla descargada saldría con los rótulos estampados.
 */

/**
 * Siluetas de los moldes, sacadas del desplegado UV del modelo. Se cargan
 * una vez y quedan cacheadas; hasta que llegan se dibuja sin guías, que es
 * mejor que dibujar rectángulos que no son la forma real.
 */
function useSilhouettes(): Silhouettes | null {
  const [tris, setTris] = useState<Silhouettes | null>(null);
  useEffect(() => {
    let alive = true;
    loadRefSilhouettes().then((t) => {
      if (alive) setTris(t);
    });
    return () => {
      alive = false;
    };
  }, []);
  return tris;
}

const GUIDE_LINE = "rgba(255,255,255,0.35)";
const GUIDE_TEXT = "rgba(255,255,255,0.85)";
const GUIDE_CHIP = "rgba(11,13,16,0.75)";

interface RectGuide {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  upsideDown: boolean;
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  size: number,
  { x, y, w, h, label, upsideDown }: RectGuide,
) {
  const px = x * size;
  const py = y * size;
  const pw = w * size;
  const ph = h * size;

  ctx.strokeStyle = GUIDE_LINE;
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.setLineDash([]);

  ctx.save();
  // El rótulo girado en la espalda es la señal de qué lado va arriba.
  if (upsideDown) {
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-pw / 2, -ph / 2);
  } else {
    ctx.translate(px, py);
  }
  ctx.font = `600 ${Math.round(size * 0.018)}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = GUIDE_CHIP;
  ctx.fillRect(6, ph - size * 0.038, tw + 14, size * 0.028);
  ctx.fillStyle = GUIDE_TEXT;
  ctx.fillText(label, 13, ph - size * 0.018);
  ctx.restore();
}

function GarmentCanvas({
  design,
  revision,
  garment,
}: {
  design: DesignState;
  revision: number;
  garment: GarmentId;
}) {
  const contentRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const size = GARMENT_ATLASES[garment].size;
  const isJersey = garment === "jersey";
  const silhouettes = useSilhouettes();

  useEffect(() => {
    const content = contentRef.current?.getContext("2d");
    const guides = guideRef.current?.getContext("2d");
    if (!content || !guides) return;

    /**
     * Se redibuja cuando terminan de cargar las imágenes. El renderer es
     * síncrono y las texturas y logos son dataURL que cargan async: sin
     * esto, entrar a la pestaña con una imagen todavía cargando dejaba el
     * patrón de abajo dibujado para siempre.
     */
    const paint = () => {
      if (isJersey) {
        renderReferenceTemplate(content, design, size);
      } else {
        content.clearRect(0, 0, size, size);
        renderGarment(content, design, garment, size);
      }

      guides.clearRect(0, 0, size, size);

      if (isJersey) {
        // Sin siluetas todavía: mejor sin guías que con rectángulos, que no
        // son la forma real del molde.
        if (silhouettes) renderPieceOutlines(guides, silhouettes, size);
        return;
      }

      // Short y medias siguen siendo rectángulos de verdad: su atlas es
      // nuestro y las piezas ocupan el rect entero.
      const atlas = GARMENT_ATLASES[garment];
      const shapes = atlas.pieces.map((p) => ({
        x: p.rect.x,
        y: 1 - (p.rect.y + p.rect.h),
        w: p.rect.w,
        h: p.rect.h,
        label: p.label.toUpperCase(),
        upsideDown: false,
      }));

      guides.save();
      guides.beginPath();
      guides.rect(0, 0, size, size);
      for (const s of shapes) {
        guides.rect(s.x * size, s.y * size, s.w * size, s.h * size);
      }
      guides.fillStyle = "rgba(11, 13, 16, 0.88)";
      guides.fill("evenodd");
      guides.restore();

      for (const s of shapes) drawGuide(guides, size, s);
    };

    paint();
    return onImagesReady(paint);
  }, [design, revision, garment, size, isJersey, silhouettes]);

  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <div className="relative w-full max-w-[420px]">
        <canvas
          ref={contentRef}
          width={size}
          height={size}
          className="aspect-square w-full rounded-lg border border-ink-700 bg-ink-800"
        />
        <canvas
          ref={guideRef}
          width={size}
          height={size}
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="text-[11px] uppercase tracking-[0.13em] text-ink-500">
        {GARMENT_LABELS[garment]}
        {isJersey ? " — layout del modelo" : null}
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
