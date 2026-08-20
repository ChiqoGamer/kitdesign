import * as THREE from "three";
import type { PieceRect } from "./atlas";

/**
 * Maquinaria compartida para emitir superficies como piezas de patrón.
 * La usan la camiseta, el short y las medias.
 */

export interface Grid {
  pos: THREE.Vector3[][]; // [fila][columna]
  nrm: THREE.Vector3[][];
}

export interface Accum {
  position: number[];
  normal: number[];
  uv: number[];
  /** Oclusión ambiental horneada como color de vértice (gris). */
  color: number[];
  index: number[];
}

export function newAccum(): Accum {
  return { position: [], normal: [], uv: [], color: [], index: [] };
}

/**
 * Oclusión ambiental por curvatura, calculada desde los vecinos de la
 * rejilla. Es lo que le da profundidad a un render: los pliegues, el
 * interior del cuello, la raíz de la manga y el ruedo se hunden y por lo
 * tanto se oscurecen. Un vértice cóncavo (metido hacia adentro respecto de
 * sus vecinos) recibe menos luz ambiente; uno convexo, apenas más.
 *
 * Se mide la componente del desplazamiento vértice→promedio-de-vecinos a lo
 * largo de la normal, normalizada por el espaciado local para que sea
 * independiente de la escala de la malla.
 */
function occlusionAt(
  grid: Grid,
  i: number,
  col: number,
  rows: number,
  cols: number,
): number {
  const p = grid.pos[i][col];
  const n = grid.nrm[i][col];
  const neighbors: THREE.Vector3[] = [];
  if (i > 0) neighbors.push(grid.pos[i - 1][col]);
  if (i < rows) neighbors.push(grid.pos[i + 1][col]);
  if (grid.pos[i][col - 1]) neighbors.push(grid.pos[i][col - 1]);
  if (grid.pos[i][col + 1]) neighbors.push(grid.pos[i][col + 1]);
  if (neighbors.length === 0) return 1;

  let ax = 0;
  let ay = 0;
  let az = 0;
  let spacing = 0;
  for (const q of neighbors) {
    ax += q.x;
    ay += q.y;
    az += q.z;
    spacing += q.distanceTo(p);
  }
  const inv = 1 / neighbors.length;
  ax = ax * inv - p.x;
  ay = ay * inv - p.y;
  az = az * inv - p.z;
  spacing *= inv;
  if (spacing < 1e-6) return 1;

  // concavidad>0 cuando el vértice está hundido respecto de sus vecinos.
  const concavity = (ax * n.x + ay * n.y + az * n.z) / spacing;
  const ao = 1 - Math.max(0, concavity) * 2.2;
  return Math.min(1, Math.max(0.62, ao));
}

/**
 * Emite una sub-rejilla como pieza de patrón.
 *
 * La UV se calcula por **longitud de arco**, no por índice: cada fila se
 * centra y se escala contra la fila más ancha. Eso hace que la pieza se
 * angoste donde la superficie se angosta, igual que un molde real — y en
 * consecuencia una raya recta dibujada en el plano converge sobre el
 * hombro, como en una camiseta sublimada de verdad.
 */
export function emitPiece(
  acc: Accum,
  grid: Grid,
  colStart: number,
  colEnd: number,
  rect: PieceRect,
  opts: { flipU?: boolean } = {},
): void {
  const rows = grid.pos.length - 1;
  const gridCols = grid.pos[0].length - 1;
  const cols = colEnd - colStart;
  const base = acc.position.length / 3;

  // Longitud de arco horizontal por fila.
  const arc: number[][] = [];
  let maxArc = 0;
  for (let i = 0; i <= rows; i++) {
    const row: number[] = [0];
    let acum = 0;
    for (let j = colStart; j < colEnd; j++) {
      acum += grid.pos[i][j].distanceTo(grid.pos[i][j + 1]);
      row.push(acum);
    }
    arc.push(row);
    maxArc = Math.max(maxArc, acum);
  }

  // Longitud de arco vertical por columna (promediada: una sola V para
  // toda la fila mantiene rectas las rayas horizontales).
  const vAcc: number[] = [0];
  let maxV = 0;
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = colStart; j <= colEnd; j++) {
      sum += grid.pos[i][j].distanceTo(grid.pos[i + 1][j]);
    }
    maxV += sum / (cols + 1);
    vAcc.push(maxV);
  }

  for (let i = 0; i <= rows; i++) {
    const rowArc = arc[i];
    const total = rowArc[cols];
    for (let j = 0; j <= cols; j++) {
      const col = colStart + j;
      const p = grid.pos[i][col];
      const n = grid.nrm[i][col];
      acc.position.push(p.x, p.y, p.z);
      acc.normal.push(n.x, n.y, n.z);

      const ao = occlusionAt(grid, i, col, rows, gridCols);
      acc.color.push(ao, ao, ao);

      // Centrada respecto a la fila más ancha del molde.
      let u = 0.5 + (rowArc[j] - total / 2) / maxArc;
      if (opts.flipU) u = 1 - u;
      const v = vAcc[i] / maxV;
      acc.uv.push(rect.x + u * rect.w, rect.y + v * rect.h);
    }
  }

  const stride = cols + 1;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = base + i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      acc.index.push(a, c, b, b, c, d);
    }
  }
}

/** Vértice suelto con AO explícita (tapas de puño, puntera, etc.). */
export function pushVertex(
  acc: Accum,
  p: THREE.Vector3,
  n: THREE.Vector3,
  u: number,
  v: number,
  ao = 0.82,
): number {
  const index = acc.position.length / 3;
  acc.position.push(p.x, p.y, p.z);
  acc.normal.push(n.x, n.y, n.z);
  acc.color.push(ao, ao, ao);
  acc.uv.push(u, v);
  return index;
}

export function toBufferGeometry(acc: Accum): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(acc.position, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(acc.normal, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(acc.uv, 2));
  if (acc.color.length) {
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(acc.color, 3),
    );
  }
  geometry.setIndex(acc.index);
  geometry.computeBoundingSphere();
  return geometry;
}
