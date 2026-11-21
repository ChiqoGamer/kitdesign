import * as THREE from "three";
import { PIECE_BY_ID } from "./atlas";
import { lerp, noise2, profileAt, smoothstep } from "./math";
import {
  emitPiece,
  gridNormals,
  mirrorGridX,
  newAccum,
  pushVertex,
  toBufferGeometry,
  type Accum,
  type Grid,
} from "./surface";

/**
 * MEDIA PARAMÉTRICA
 * =================
 * Un tubo que sigue una línea central: baja recto por la pierna, en el
 * tobillo dobla hacia adelante pasando por el talón y termina en una
 * puntera redondeada. Cada sección es una elipse orientada con el marco de
 * esa curva.
 *
 * Lo que la hace leer como media y no como caño:
 *  - Puño vuelto arriba: una banda apenas más gruesa, con su pliegue, y el
 *    borde que se mete hacia adentro.
 *  - Pantorrilla con volumen atrás, tobillo fino, talón marcado.
 *  - Pie elíptico (más ancho que alto) que se cierra en la puntera en vez
 *    de terminar en un disco plano.
 *  - Pies abiertos unos grados hacia afuera, como apoya una persona: de
 *    frente el pie ya no es un círculo mirando a cámara.
 *
 * La línea central vive en el plano YZ, así que el costado del marco es
 * siempre +X y no hace falta transporte paralelo: no hay giro del marco ni
 * casos degenerados cuando el eje se vuelve horizontal.
 */

const N_ROWS = 56;
const N_THETA = 48;

const TOP_Y = 0.47;
const ANKLE_Y = 0.105;
/**
 * Radio de la curva del tobillo. Tiene que ser mayor que el semieje frontal
 * de la sección en ese tramo: si no, el frente del tobillo se cruza consigo
 * mismo y aparecen caras invertidas.
 */
const BEND_R = 0.054;
const FOOT_LEN = 0.165;
/** Separación de cada media respecto del eje del cuerpo. */
const SIDE_X = 0.115;
/** Apertura de los pies hacia afuera, en radianes. */
const TOE_OUT = 0.16;

/** Tramos del recorrido (fracción 0..1): pierna, curva del tobillo, pie. */
const K_ANKLE = 0.64;
const K_FOOT = 0.78;

/** Semieje lateral (ancho) a lo largo del recorrido. */
const RX_PROFILE: [number, number][] = [
  [0.0, 0.054], // puño
  [0.1, 0.054],
  [0.3, 0.058], // pantorrilla
  [0.55, 0.043],
  [K_ANKLE, 0.04], // tobillo
  [K_FOOT, 0.045],
  [0.9, 0.046], // metatarso
  [1.0, 0.04],
];

/** Semieje frontal en la pierna / alto en el pie. */
const RY_PROFILE: [number, number][] = [
  [0.0, 0.055],
  [0.1, 0.056],
  [0.3, 0.064], // pantorrilla, con volumen atrás
  [0.55, 0.046],
  [K_ANKLE, 0.044],
  [0.72, 0.052], // talón
  [K_FOOT, 0.04],
  [0.9, 0.03],
  [1.0, 0.026],
];

/** Desplazamiento del centro hacia atrás (pantorrilla y talón). */
const BACK_SHIFT: [number, number][] = [
  [0.0, 0.0],
  [0.3, 0.008],
  [0.55, 0.0],
  [0.7, 0.012], // talón
  [K_FOOT, 0.0],
  [1.0, 0.0],
];

/** Puño vuelto: alto (fracción del recorrido) y cuánto sobresale. */
const CUFF_K = 0.11;
const CUFF_BULGE = 0.0035;
const LIP_INSET = 0.006;
const LIP_DEPTH = 0.025;

/** Línea central (sin la apertura de los pies). */
function centerAt(k: number, out: THREE.Vector3): THREE.Vector3 {
  if (k <= K_ANKLE) {
    return out.set(0, lerp(TOP_Y, ANKLE_Y, k / K_ANKLE), 0);
  }
  if (k <= K_FOOT) {
    // Cuarto de vuelta: de bajar en -Y a avanzar en +Z.
    const a = ((k - K_ANKLE) / (K_FOOT - K_ANKLE)) * (Math.PI / 2);
    const r = BEND_R;
    return out.set(0, ANKLE_Y - Math.sin(a) * r, r * (1 - Math.cos(a)));
  }
  const t = (k - K_FOOT) / (1 - K_FOOT);
  const r = BEND_R;
  return out.set(0, ANKLE_Y - r - 0.004 * t, lerp(r, FOOT_LEN, t));
}

/** Cierre de la puntera: los radios caen como un cuarto de elipse. */
function toeClose(k: number): number {
  const t = (k - 0.9) / 0.1;
  if (t <= 0) return 1;
  return Math.sqrt(Math.max(0.0025, 1 - t * t));
}

interface RowSpec {
  k: number;
  inset: number;
  /** Corrimiento a lo largo del eje (sólo el vuelto del puño). */
  along: number;
}

function rowSpecs(): RowSpec[] {
  const rows: RowSpec[] = [
    // Borde del puño: baja por adentro y dobla arriba.
    { k: 0, inset: LIP_INSET, along: LIP_DEPTH },
    { k: 0, inset: LIP_INSET, along: LIP_DEPTH * 0.35 },
    { k: 0, inset: LIP_INSET * 0.7, along: -0.002 },
    { k: 0, inset: LIP_INSET * 0.25, along: -0.0035 },
  ];
  for (let i = 0; i <= N_ROWS; i++) rows.push({ k: i / N_ROWS, inset: 0, along: 0 });
  return rows;
}

/**
 * Media del lado +x. El sentido de `a` (hacia atrás primero) con las filas
 * avanzando de arriba a la puntera deja dFila × dColumna apuntando afuera.
 */
function sampleSock(): Grid {
  const axis = new THREE.Vector3();
  const side = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3();
  const c0 = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const toeOut = new THREE.Matrix4().makeRotationY(TOE_OUT);
  const ankle = new THREE.Vector3(0, ANKLE_Y, 0);

  const pos: THREE.Vector3[][] = [];
  for (const spec of rowSpecs()) {
    const k = spec.k;
    centerAt(Math.max(0, k - 0.004), c0);
    centerAt(Math.min(1, k + 0.004), c1);
    axis.subVectors(c1, c0).normalize();
    // "Frente" de la sección: en la pierna es +Z, en el pie es +Y.
    up.crossVectors(axis, side).normalize();
    centerAt(k, c0);
    c0.addScaledVector(axis, -spec.along);
    c0.addScaledVector(up, -profileAt(k, BACK_SHIFT));

    const cuff = 1 - smoothstep((k - CUFF_K) / 0.012);
    const close = toeClose(k);
    const rx = (profileAt(k, RX_PROFILE) + cuff * CUFF_BULGE) * close - spec.inset;
    const ry = (profileAt(k, RY_PROFILE) + cuff * CUFF_BULGE) * close - spec.inset;
    // Un poco de tela floja en la caña, nada en el pie.
    const slack = 0.012 * (1 - smoothstep((k - 0.45) / 0.15));

    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= N_THETA; j++) {
      const a = (j / N_THETA) * Math.PI * 2;
      const wob = 1 + slack * noise2(a * 2.1 + 3, k * 6);
      const p = new THREE.Vector3()
        .copy(c0)
        .addScaledVector(side, -Math.sin(a) * rx * wob)
        .addScaledVector(up, -Math.cos(a) * ry * wob);
      // El pie se abre girando alrededor del tobillo; la caña queda derecha.
      if (k > K_ANKLE - 0.04) {
        const w = smoothstep((k - (K_ANKLE - 0.04)) / 0.1);
        const turned = p.clone().sub(ankle).applyMatrix4(toeOut).add(ankle);
        p.lerp(turned, w);
      }
      p.x += SIDE_X;
      row.push(p);
    }
    pos.push(row);
  }
  return { pos, nrm: gridNormals(pos) };
}

/** Tapa la puntera con un abanico (el tubo ya llega casi cerrado). */
function emitToeCap(
  acc: Accum,
  grid: Grid,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const rows = grid.pos.length;
  const rim = grid.pos[rows - 1];
  const c = new THREE.Vector3();
  for (const p of rim) c.add(p);
  c.divideScalar(rim.length);
  const n = c.clone().sub(grid.pos[rows - 4][0]).setY(0).normalize();
  const u = rect.x + rect.w / 2;
  const v = rect.y + rect.h * 0.995;
  const center = pushVertex(acc, c, n, u, v, 0.75);
  for (let j = 0; j < rim.length; j++) pushVertex(acc, rim[j], n, u, v, 0.75);
  // Mismo sentido que el tubo: el anillo final se recorre igual.
  for (let j = 0; j < rim.length - 1; j++) {
    acc.index.push(center, center + 2 + j, center + 1 + j);
  }
}

export function buildSocksGeometry(): THREE.BufferGeometry {
  const acc = newAccum();
  const right = sampleSock();
  const left = mirrorGridX(right);
  emitPiece(acc, right, 0, N_THETA, PIECE_BY_ID.sockR.rect);
  emitPiece(acc, left, 0, N_THETA, PIECE_BY_ID.sockL.rect);
  emitToeCap(acc, right, PIECE_BY_ID.sockR.rect);
  emitToeCap(acc, left, PIECE_BY_ID.sockL.rect);
  return toBufferGeometry(acc);
}

export const SOCKS_HEIGHT = TOP_Y;
