import type { PatternId, PatternParams } from "@core/types";

/**
 * Los patrones se dibujan en **espacio de prenda**, no en espacio de
 * rectángulo. `gu` es la posición alrededor del cuerpo medida en longitud
 * de arco (0 = centro delantero, ±0.5 = centro espalda) y `gv` la altura.
 *
 * Por eso una raya vertical sale continua al cruzar la costura lateral:
 * el delantero y la espalda son dos rectángulos distintos del atlas, pero
 * las rayas se calculan sobre la misma coordenada de prenda.
 */
export interface PaintContext {
  ctx: CanvasRenderingContext2D;
  /** Rectángulo destino en píxeles del canvas. */
  rect: { x: number; y: number; w: number; h: number };
  /** Valor de gu en el borde izquierdo y derecho del rectángulo. */
  gu: [number, number];
  /** Valor de gv en el borde inferior y superior. */
  gv: [number, number];
  /** Colores ya resueltos contra la paleta. */
  colors: string[];
  params: PatternParams;
}

function wrap01(x: number): number {
  return x - Math.floor(x);
}

function wrapSigned(x: number): number {
  return wrap01(x + 0.5) - 0.5;
}

/** gu → x en píxeles (el mapeo puede ser decreciente; es lineal igual). */
function xOf(c: PaintContext, u: number): number {
  const [a, b] = c.gu;
  return c.rect.x + ((u - a) / (b - a)) * c.rect.w;
}

/** gv → y en píxeles (el canvas tiene Y hacia abajo; la prenda hacia arriba). */
function yOf(c: PaintContext, v: number): number {
  const [a, b] = c.gv;
  return c.rect.y + c.rect.h - ((v - a) / (b - a)) * c.rect.h;
}

function bandU(c: PaintContext, u0: number, u1: number, color: string): void {
  const x0 = xOf(c, u0);
  const x1 = xOf(c, u1);
  c.ctx.fillStyle = color;
  c.ctx.fillRect(Math.min(x0, x1), c.rect.y, Math.abs(x1 - x0), c.rect.h);
}

function bandV(c: PaintContext, v0: number, v1: number, color: string): void {
  const y0 = yOf(c, v0);
  const y1 = yOf(c, v1);
  c.ctx.fillStyle = color;
  c.ctx.fillRect(c.rect.x, Math.min(y0, y1), c.rect.w, Math.abs(y1 - y0));
}

function fillAll(c: PaintContext, color: string): void {
  c.ctx.fillStyle = color;
  c.ctx.fillRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
}

type Painter = (c: PaintContext) => void;

const solid: Painter = (c) => fillAll(c, c.colors[0]);

const stripesV: Painter = (c) => {
  fillAll(c, c.colors[0]);
  const { count, width, offset } = c.params;
  const step = 1 / count;
  const halfW = (width * step) / 2;
  const lo = Math.min(...c.gu);
  const hi = Math.max(...c.gu);
  // Se recorren también las repeticiones vecinas para que una raya que
  // entra por el borde del molde se dibuje completa.
  const kFrom = Math.floor(lo / step) - 1;
  const kTo = Math.ceil(hi / step) + 1;
  for (let k = kFrom; k <= kTo; k++) {
    const center = (k + offset) * step;
    bandU(c, center - halfW, center + halfW, c.colors[1]);
  }
};

const stripesH: Painter = (c) => {
  fillAll(c, c.colors[0]);
  const { count, width, offset } = c.params;
  const step = 1 / count;
  const halfW = (width * step) / 2;
  for (let k = -1; k <= count + 1; k++) {
    const center = (k + offset) * step;
    bandV(c, center - halfW, center + halfW, c.colors[1]);
  }
};

const halves: Painter = (c) => {
  fillAll(c, c.colors[0]);
  const split = c.params.position - 0.5;
  const [a, b] = c.gu;
  const steps = 96;
  c.ctx.fillStyle = c.colors[1];
  // Se recorre el molde en tiras finas y se pintan las que caen del lado
  // correcto de la línea de corte. Es robusto ante el envolvente.
  for (let i = 0; i < steps; i++) {
    const u0 = a + ((b - a) * i) / steps;
    const u1 = a + ((b - a) * (i + 1)) / steps;
    const mid = (u0 + u1) / 2;
    if (wrapSigned(mid - split) > 0) {
      const x0 = xOf(c, u0);
      const x1 = xOf(c, u1);
      c.ctx.fillRect(
        Math.min(x0, x1) - 1,
        c.rect.y,
        Math.abs(x1 - x0) + 2,
        c.rect.h,
      );
    }
  }
};

const sash: Painter = (c) => {
  fillAll(c, c.colors[0]);
  const { angle, width, position } = c.params;
  const ctx = c.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
  ctx.clip();
  ctx.translate(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2);
  ctx.rotate((-angle * Math.PI) / 180);
  const band = width * c.rect.h;
  const diag = Math.hypot(c.rect.w, c.rect.h);
  const centerY = (0.5 - position) * c.rect.h;
  ctx.fillStyle = c.colors[1];
  ctx.fillRect(-diag, centerY - band / 2, diag * 2, band);
  ctx.restore();
};

const gradient: Painter = (c) => {
  const g = c.ctx.createLinearGradient(
    0,
    c.rect.y + c.rect.h,
    0,
    c.rect.y,
  );
  const mid = Math.min(0.98, Math.max(0.02, c.params.position));
  g.addColorStop(0, c.colors[0]);
  g.addColorStop(mid, c.colors[0]);
  g.addColorStop(1, c.colors[1]);
  c.ctx.fillStyle = g;
  c.ctx.fillRect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
};

export const PAINTERS: Record<PatternId, Painter> = {
  solid,
  stripesV,
  stripesH,
  halves,
  sash,
  gradient,
};
