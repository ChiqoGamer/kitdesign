import { resolveColor, type DesignState } from "@core/types";
import { renderFlatJersey } from "./flat";

/**
 * IMAGEN DE PRESENTACIÓN
 * ======================
 * Una lámina lista para compartir: nombre del club, la camiseta de frente y
 * de espalda, y la paleta con sus códigos.
 *
 * Se construye con el renderer plano y no con una captura del 3D a
 * propósito: es sincrónico y determinista (mismo diseño → mismo pixel), no
 * depende del estado de la GPU ni de esperar frames, y sale nítido a
 * cualquier resolución. Los códigos de color van impresos porque es lo
 * primero que pregunta un fabricante.
 */

export interface PresentationOptions {
  width?: number;
  height?: number;
  /** Familia tipográfica del documento, para que la lámina no se vea ajena. */
  fontFamily?: string;
}

const DEFAULTS = { width: 1200, height: 1500 };

export function renderPresentation(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  options: PresentationOptions = {},
): void {
  const W = options.width ?? DEFAULTS.width;
  const H = options.height ?? DEFAULTS.height;
  const font = options.fontFamily ?? 'system-ui, -apple-system, sans-serif';

  // Fondo con un degradado muy sutil para que no se vea plano.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#12151b");
  bg.addColorStop(1, "#0a0c10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pad = W * 0.07;

  // --- Encabezado ---
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c6f24e";
  ctx.font = `700 ${W * 0.022}px ${font}`;
  ctx.fillText("KITDESIGN", pad, pad + W * 0.02);

  ctx.fillStyle = "#f2f5f8";
  ctx.font = `800 ${W * 0.056}px ${font}`;
  ctx.fillText(state.meta.clubName.toUpperCase(), pad, pad + W * 0.085);

  ctx.fillStyle = "#9aa3b1";
  ctx.font = `500 ${W * 0.03}px ${font}`;
  ctx.fillText(state.meta.name, pad, pad + W * 0.125);

  // --- Camisetas: frente y espalda ---
  const gap = W * 0.03;
  const boxW = (W - pad * 2 - gap) / 2;
  const boxH = boxW * 1.22;
  const top = pad + W * 0.175;

  const labels: Array<["front" | "back", string]> = [
    ["front", "FRENTE"],
    ["back", "ESPALDA"],
  ];
  labels.forEach(([side, label], i) => {
    const x = pad + i * (boxW + gap);
    // Tarjeta de fondo para separar la prenda del lienzo.
    ctx.fillStyle = "#171b22";
    roundRect(ctx, x, top, boxW, boxH, W * 0.014);
    ctx.fill();

    renderFlatJersey(ctx, state, side, {
      x: x + boxW * 0.06,
      y: top + boxH * 0.05,
      w: boxW * 0.88,
      h: boxH * 0.86,
    });

    ctx.fillStyle = "#6b7482";
    ctx.font = `700 ${W * 0.018}px ${font}`;
    ctx.textAlign = "center";
    ctx.fillText(label, x + boxW / 2, top + boxH - boxH * 0.03);
    ctx.textAlign = "left";
  });

  // --- Paleta con códigos ---
  const paletteY = top + boxH + W * 0.06;
  ctx.fillStyle = "#6b7482";
  ctx.font = `700 ${W * 0.016}px ${font}`;
  ctx.fillText("COLORES", pad, paletteY);

  const swatch = W * 0.055;
  state.palette.forEach((entry, i) => {
    const x = pad + i * (swatch + W * 0.045);
    const y = paletteY + W * 0.02;
    ctx.fillStyle = entry.hex;
    roundRect(ctx, x, y, swatch, swatch, W * 0.008);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.stroke();

    ctx.fillStyle = "#dfe4ea";
    ctx.font = `600 ${W * 0.016}px ${font}`;
    ctx.fillText(entry.name, x, y + swatch + W * 0.028);
    ctx.fillStyle = "#6b7482";
    ctx.font = `500 ${W * 0.014}px ui-monospace, monospace`;
    ctx.fillText(entry.hex, x, y + swatch + W * 0.05);
  });

  // --- Confección ---
  const specY = paletteY + W * 0.02 + swatch + W * 0.095;
  const { collar, sleeve } = state.kit.construction;
  const collarLabel = collar === "v" ? "En V" : "Redondo";
  const sleeveLabel = sleeve === "long" ? "Larga" : "Corta";
  ctx.fillStyle = "#6b7482";
  ctx.font = `700 ${W * 0.016}px ${font}`;
  ctx.fillText("CONFECCIÓN", pad, specY);
  ctx.fillStyle = "#dfe4ea";
  ctx.font = `500 ${W * 0.02}px ${font}`;
  ctx.fillText(
    `Cuello ${collarLabel}  ·  Manga ${sleeveLabel}`,
    pad,
    specY + W * 0.035,
  );

  // Colores del cuerpo resueltos, útiles para el fabricante.
  const bodyColor = resolveColor(state, state.kit.zones.body.colors[0]);
  ctx.fillStyle = "#6b7482";
  ctx.font = `500 ${W * 0.014}px ui-monospace, monospace`;
  ctx.fillText(`Base del cuerpo ${bodyColor}`, pad, specY + W * 0.062);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
