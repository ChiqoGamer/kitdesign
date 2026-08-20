export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Superelipse. n=2 da una elipse; n>2 la "acuadra".
 * Un torso de camiseta lee mejor con n≈2.7 que con una elipse pura:
 * la elipse se ve como un globo, la superelipse como una prenda.
 */
export function superellipse(theta: number, n: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  return [
    Math.sign(c) * Math.pow(Math.abs(c), e),
    Math.sign(s) * Math.pow(Math.abs(s), e),
  ];
}

/**
 * Interpola un perfil definido por puntos de control [posición, valor],
 * con smoothstep entre ellos. Se usa para el ancho/profundidad del torso
 * a lo largo de la altura (dobladillo → cintura → pecho → hombro).
 */
export function profileAt(u: number, points: [number, number][]): number {
  if (u <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (u >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (u >= x0 && u <= x1) {
      return lerp(y0, y1, smoothstep((u - x0) / (x1 - x0)));
    }
  }
  return last[1];
}

function hash2(ix: number, iy: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Ruido de valor 2D, suave y determinista (misma entrada → misma malla,
 * requisito para que las UVs y los tests de snapshot sean estables).
 */
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy) - 0.5;
}
