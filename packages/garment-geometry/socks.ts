import * as THREE from "three";
import { PIECE_BY_ID } from "./atlas";
import { lerp, profileAt, smoothstep } from "./math";
import {
  emitPiece,
  newAccum,
  pushVertex,
  toBufferGeometry,
  type Grid,
} from "./surface";

/**
 * MEDIA PARAMÉTRICA
 * =================
 * Tubo cónico con pantorrilla, que en el tobillo dobla hacia adelante y
 * forma el pie. La línea central es una curva; cada sección es un círculo
 * orientado con el marco local de esa curva (igual que la manga).
 */

const N_ROWS = 34;
const N_THETA = 40;

const TOP_Y = 0.47;
const ANKLE_Y = 0.055;
const FOOT_LEN = 0.155;

/** Radio del tubo a lo largo del recorrido (0 = puño, 1 = puntera). */
const RADIUS_PROFILE: [number, number][] = [
  [0.0, 0.0555], // puño
  [0.28, 0.062], // pantorrilla
  [0.62, 0.046], // tobillo
  [0.8, 0.049], // empeine
  [1.0, 0.03], // puntera
];

/** Fracción del recorrido donde empieza el pie. */
const BEND_START = 0.62;

function centerAt(k: number, out: THREE.Vector3): THREE.Vector3 {
  if (k <= BEND_START) {
    const t = k / BEND_START;
    return out.set(0, lerp(TOP_Y, ANKLE_Y, t), 0);
  }
  const t = smoothstep((k - BEND_START) / (1 - BEND_START));
  // El tobillo dobla: baja un poco más y avanza en +Z.
  return out.set(0, lerp(ANKLE_Y, 0.028, t), FOOT_LEN * t);
}

function sampleSock(side: 1 | -1): Grid {
  const axis = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const c0 = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 0, -1);

  const pos: THREE.Vector3[][] = [];
  const nrm: THREE.Vector3[][] = [];

  for (let i = 0; i <= N_ROWS; i++) {
    const k = i / N_ROWS;
    centerAt(Math.max(0, k - 0.004), c0);
    centerAt(Math.min(1, k + 0.004), c1);
    axis.subVectors(c1, c0).normalize();
    right.crossVectors(axis, worldUp).normalize();
    if (right.lengthSq() < 0.5) right.set(1, 0, 0);
    up.crossVectors(right, axis).normalize();
    centerAt(k, c0);

    const r = profileAt(k, RADIUS_PROFILE);

    const pr: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let j = 0; j <= N_THETA; j++) {
      const a = (j / N_THETA) * Math.PI * 2;
      const n = new THREE.Vector3()
        .addScaledVector(right, Math.cos(a))
        .addScaledVector(up, Math.sin(a))
        .normalize();
      pr.push(new THREE.Vector3().copy(c0).addScaledVector(n, r));
      nr.push(n);
    }
    pos.push(pr);
    nrm.push(nr);
  }

  // Desplaza al lado que corresponda.
  for (const row of pos) for (const p of row) p.x += side * 0.115;
  return { pos, nrm };
}

function emitToeCap(
  acc: import("./surface").Accum,
  grid: Grid,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const rim = grid.pos[grid.pos.length - 1];
  const c = new THREE.Vector3();
  for (const p of rim) c.add(p);
  c.divideScalar(rim.length);
  const n = new THREE.Vector3(0, 0, 1);
  const center = pushVertex(acc, c, n, rect.x + rect.w / 2, rect.y + rect.h * 0.99, 0.7);
  for (let j = 0; j < rim.length; j++) {
    pushVertex(acc, rim[j], n, rect.x + rect.w / 2, rect.y + rect.h * 0.99, 0.72);
  }
  for (let j = 0; j < rim.length - 1; j++) {
    acc.index.push(center, center + 1 + j, center + 2 + j);
  }
}

export function buildSocksGeometry(): THREE.BufferGeometry {
  const acc = newAccum();
  const gridR = sampleSock(1);
  const gridL = sampleSock(-1);
  emitPiece(acc, gridR, 0, N_THETA, PIECE_BY_ID.sockR.rect);
  emitPiece(acc, gridL, 0, N_THETA, PIECE_BY_ID.sockL.rect, { flipU: true });
  emitToeCap(acc, gridR, PIECE_BY_ID.sockR.rect);
  emitToeCap(acc, gridL, PIECE_BY_ID.sockL.rect);
  return toBufferGeometry(acc);
}

export const SOCKS_HEIGHT = TOP_Y;
