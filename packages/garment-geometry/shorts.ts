import * as THREE from "three";
import { PIECE_BY_ID } from "./atlas";
import { lerp, profileAt, superellipse } from "./math";
import { emitPiece, newAccum, toBufferGeometry, type Grid } from "./surface";

/**
 * SHORT PARAMÉTRICO
 * =================
 * Dos piernas como lofts de secciones superelípticas, ligeramente
 * inclinadas hacia afuera, que se solapan en la entrepierna. Solapar en
 * vez de modelar el tiro real es el mismo truco que la sisa de la manga:
 * invisible desde afuera y muchísimo más barato que una unión limpia.
 *
 * Unidades: metros, en espacio local del short (cintura arriba).
 */

const N_THETA = 96;
const N_ROWS = 22;
const SUPER_N = 2.5;

const WAIST_Y = 0.44;
const HEM_Y = 0;

/** Semieje lateral (ancho) de cada pierna a lo largo de la altura. */
const WIDTH_PROFILE: [number, number][] = [
  [0.0, 0.108], // ruedo
  [0.45, 0.125],
  [0.8, 0.15], // cadera
  [1.0, 0.143], // cintura (entra apenas)
];

/** Semieje frontal (profundidad). */
const DEPTH_PROFILE: [number, number][] = [
  [0.0, 0.096],
  [0.5, 0.106],
  [1.0, 0.1],
];

/** Desplazamiento del centro de la pierna respecto del eje del cuerpo. */
function legCenterX(t: number): number {
  // t=1 cintura (piernas juntas, se solapan al centro), t=0 ruedo (abiertas).
  return lerp(0.124, 0.048, t);
}

function legPoint(
  side: 1 | -1,
  theta: number,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const [sx, sz] = superellipse(theta, SUPER_N);
  const w = profileAt(t, WIDTH_PROFILE);
  const d = profileAt(t, DEPTH_PROFILE);
  return out.set(
    side * legCenterX(t) + w * sx,
    lerp(HEM_Y, WAIST_Y, t),
    d * sz,
  );
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dTheta = new THREE.Vector3();
const _dT = new THREE.Vector3();

function legNormal(
  side: 1 | -1,
  theta: number,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const h = 1e-4;
  legPoint(side, theta + h, t, _a);
  legPoint(side, theta - h, t, _b);
  _dTheta.subVectors(_a, _b);
  legPoint(side, theta, Math.min(1, t + h), _a);
  legPoint(side, theta, Math.max(0, t - h), _b);
  _dT.subVectors(_a, _b);
  return out.crossVectors(_dT, _dTheta).normalize();
}

function sampleLeg(side: 1 | -1): Grid {
  const pos: THREE.Vector3[][] = [];
  const nrm: THREE.Vector3[][] = [];
  for (let i = 0; i <= N_ROWS; i++) {
    const t = i / N_ROWS;
    const pr: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let j = 0; j <= N_THETA; j++) {
      // Arranca en la cara interna (θ=−π/2 mirando al otro lado del cuerpo
      // según el lado), así la costura de la pieza queda en la entrepierna.
      const theta = Math.PI / 2 + side * ((j / N_THETA) * Math.PI * 2);
      pr.push(legPoint(side, theta, t, new THREE.Vector3()));
      nr.push(legNormal(side, theta, t, new THREE.Vector3()));
    }
    pos.push(pr);
    nrm.push(nr);
  }
  return { pos, nrm };
}

export function buildShortsGeometry(): THREE.BufferGeometry {
  const acc = newAccum();
  emitPiece(acc, sampleLeg(1), 0, N_THETA, PIECE_BY_ID.shortsR.rect);
  emitPiece(acc, sampleLeg(-1), 0, N_THETA, PIECE_BY_ID.shortsL.rect, {
    flipU: true,
  });
  return toBufferGeometry(acc);
}

export const SHORTS_HEIGHT = WAIST_Y;
