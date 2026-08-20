import * as THREE from "three";

/**
 * Analiza la malla: agrupa vértices en celdas UV (8x8) y para cada celda
 * ocupada reporta la posición 3D promedio (normalizada). Con eso se
 * identifica qué isla UV es frente / espalda / manga / cuello.
 */
export function analyzeMesh(geo: THREE.BufferGeometry): string[] {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  if (!uv) return ["sin UV"];

  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const size = new THREE.Vector3();
  const min = box.min;
  box.getSize(size);
  const nx = (v: number) => (v - min.x) / size.x;
  const ny = (v: number) => (v - min.y) / size.y;
  const nz = (v: number) => (v - min.z) / size.z;

  const N = 8;
  type Cell = { n: number; x: number; y: number; z: number; umin: number; umax: number; vmin: number; vmax: number };
  const cells = new Map<string, Cell>();
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const cu = Math.min(N - 1, Math.max(0, Math.floor(u * N)));
    const cv = Math.min(N - 1, Math.max(0, Math.floor(v * N)));
    const key = `${cu},${cv}`;
    let c = cells.get(key);
    if (!c) { c = { n: 0, x: 0, y: 0, z: 0, umin: 1, umax: 0, vmin: 1, vmax: 0 }; cells.set(key, c); }
    c.n++;
    c.x += nx(pos.getX(i));
    c.y += ny(pos.getY(i));
    c.z += nz(pos.getZ(i));
    c.umin = Math.min(c.umin, u); c.umax = Math.max(c.umax, u);
    c.vmin = Math.min(c.vmin, v); c.vmax = Math.max(c.vmax, v);
  }
  const out: string[] = [`bbox size ${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}`];
  const rows = Array.from(cells.entries())
    .filter(([, c]) => c.n > 20)
    .map(([k, c]) => `uv[${k}] n=${c.n} pos3d=(${(c.x / c.n).toFixed(2)},${(c.y / c.n).toFixed(2)},${(c.z / c.n).toFixed(2)})`);
  return out.concat(rows);
}
