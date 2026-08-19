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
