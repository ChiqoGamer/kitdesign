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
  index: number[];
}

export function newAccum(): Accum {
  return { position: [], normal: [], uv: [], index: [] };
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
      const p = grid.pos[i][colStart + j];
      const n = grid.nrm[i][colStart + j];
      acc.position.push(p.x, p.y, p.z);
      acc.normal.push(n.x, n.y, n.z);

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
  geometry.setIndex(acc.index);
  geometry.computeBoundingSphere();
  return geometry;
}
