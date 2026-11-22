import * as THREE from "three";
import { PIECE_BY_ID } from "./atlas";
import { lerp, noise2, profileAt, smoothstep, superellipse } from "./math";
import {
  emitPiece,
  gridNormals,
  mirrorGridX,
  newAccum,
  toBufferGeometry,
  type Grid,
} from "./surface";

/**
 * SHORT PARAMÉTRICO
 * =================
 * Cada pierna es una pieza de molde real: abajo envuelve la pierna entera y,
 * desde la entrepierna hacia arriba, se abre hasta cubrir media cadera, del
 * centro delantero al centro de la espalda. Así se corta un short de verdad.
 *
 * La versión anterior solapaba dos tubos en la entrepierna: las superficies
 * se cruzaban en el centro y quedaba una arista visible. Acá la parte de la
 * pierna que "sobra" del lado de adentro se aplasta contra el plano medio
 * (x = 0): queda dentro del cuerpo, invisible, y las dos piezas se encuentran
 * en la costura central como en la prenda cosida.
 *
 * Además tiene volumen donde una prenda lo tiene: cintura elástica con su
 * frunce, dobladillo vuelto hacia adentro y una caída con pliegues suaves.
 *
 * Unidades: metros, en espacio local del short (ruedo en y = 0).
 */

const N_THETA = 96;
const N_ROWS = 40;
const SUPER_N = 2.4;

const WAIST_Y = 0.44;
/** Altura de la entrepierna, como fracción del alto (tiro). */
const CROTCH_T = 0.42;

/**
 * La sección de cada fila es una mezcla de dos formas con el mismo
 * parámetro angular:
 *  - la PIERNA: un óvalo cerrado alrededor de la pierna;
 *  - la CADERA: media cadera, un óvalo centrado en el eje del cuerpo del que
 *    sólo queda la mitad de este lado (lo demás se aplasta contra x = 0).
 *
 * Abajo de la entrepierna manda la pierna; arriba, la cadera. Con la cadera
 * el centro delantero y el trasero quedan a profundidad completa, así que la
 * costura central es una arista suave y no una hendidura.
 */
const HIP_BLEND: [number, number] = [CROTCH_T - 0.05, CROTCH_T + 0.08];

/** Centro de la pierna respecto del eje del cuerpo (lado +x). */
const LEG_CENTER: [number, number][] = [
  [0.0, 0.128],
  [CROTCH_T, 0.112],
  [1.0, 0.11],
];

/** Semieje lateral de la pierna. */
const LEG_WIDTH: [number, number][] = [
  [0.0, 0.106], // ruedo, apenas acampanado
  [0.2, 0.103],
  [CROTCH_T, 0.112],
  [1.0, 0.118],
];

/** Semieje frontal de la pierna. */
const LEG_DEPTH: [number, number][] = [
  [0.0, 0.098],
  [CROTCH_T, 0.106],
  [1.0, 0.11],
];

/** Media cadera: semiancho y profundidad. */
const HIP_WIDTH: [number, number][] = [
  [CROTCH_T, 0.222],
  [0.78, 0.207],
  [0.92, 0.199],
  [1.0, 0.19], // cintura
];

const HIP_DEPTH: [number, number][] = [
  [CROTCH_T, 0.112],
  [0.78, 0.124],
  [1.0, 0.117],
];

/** Cintura elástica: alto de la banda y cuánto sobresale. */
const WAISTBAND_T = 0.09;
const WAISTBAND_BULGE = 0.0045;
/** Espesor y alto del vuelto interior (cintura y ruedo). */
const FOLD_INSET = 0.007;
const WAIST_FOLD_DEPTH = 0.035;
const HEM_FOLD_DEPTH = 0.022;

/**
 * Punto de la pierna derecha (+x).
 *
 * `phi` recorre la sección desde la cara interna (0) hacia atrás (π/2),
 * afuera (π) y adelante (3π/2). Ese sentido, con las filas subiendo, hace
 * que dFila × dColumna apunte hacia afuera: es lo que mantiene los
 * triángulos de frente sin tocar `emitPiece`.
 */
function legPoint(
  phi: number,
  t: number,
  inset: number,
  dy: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const [c, s] = superellipse(phi, SUPER_N);

  // Arrugas suaves sólo en la pierna; la cadera queda tensa.
  const loose = 1 - smoothstep((t - CROTCH_T + 0.05) / 0.25);
  const wrinkle = 1 + 0.016 * loose * noise2(phi * 2.3 + 7, t * 3.1);

  // Cintura elástica: escalón marcado (el pliegue lo oscurece la AO) y un
  // frunce fino alrededor.
  const band = smoothstep((t - (1 - WAISTBAND_T)) / 0.012);
  const gather = band * 0.0018 * noise2(phi * 15, 3.7);
  const bulge = band * WAISTBAND_BULGE + gather;

  // La cola: la espalda tiene más volumen que el frente desde la entrepierna.
  const seat = s > 0 ? 1 + 0.09 * smoothstep((t - 0.3) / 0.35) : 1;

  const k = 1 - inset / 0.11; // el vuelto interior es la misma forma, más chica
  const r = wrinkle * k;
  const hip = smoothstep((t - HIP_BLEND[0]) / (HIP_BLEND[1] - HIP_BLEND[0]));

  const legX = profileAt(t, LEG_CENTER) - profileAt(t, LEG_WIDTH) * r * c;
  const legZ = -profileAt(t, LEG_DEPTH) * r * seat * s;
  const hipX = -profileAt(t, HIP_WIDTH) * r * c;
  const hipZ = -profileAt(t, HIP_DEPTH) * r * seat * s;

  const x = lerp(legX, hipX, hip);
  const z = lerp(legZ, hipZ, hip);
  // Hacia afuera para la banda; lo que cruza el plano medio se aplasta.
  const len = Math.hypot(c, s) || 1;
  return out.set(
    Math.max(0, x - (bulge * c) / len),
    lerp(0, WAIST_Y, t) + dy,
    z - (bulge * s) / len,
  );
}

interface RowSpec {
  t: number;
  inset: number;
  dy: number;
}

/**
 * Filas de la pieza, de adentro del ruedo a adentro de la cintura.
 *
 * Los vueltos van en la misma rejilla y no como mallas aparte: así heredan
 * la UV del molde (el color del borde es el de la tela, como al doblarla) y
 * la AO de la rejilla oscurece sola el pliegue.
 */
function rowSpecs(): RowSpec[] {
  const rows: RowSpec[] = [
    // Dobladillo: sube por adentro y dobla en el ruedo.
    { t: 0, inset: FOLD_INSET, dy: HEM_FOLD_DEPTH },
    { t: 0, inset: FOLD_INSET, dy: HEM_FOLD_DEPTH * 0.4 },
    { t: 0, inset: FOLD_INSET * 0.75, dy: 0.0005 },
    { t: 0, inset: FOLD_INSET * 0.3, dy: -0.0025 },
  ];
  for (let i = 0; i <= N_ROWS; i++) {
    rows.push({ t: i / N_ROWS, inset: 0, dy: 0 });
  }
  rows.push(
    // Borde de la cintura: redondeado y hacia adentro.
    { t: 1, inset: FOLD_INSET * 0.3, dy: 0.003 },
    { t: 1, inset: FOLD_INSET * 0.75, dy: 0.0035 },
    { t: 1, inset: FOLD_INSET, dy: 0 },
    { t: 1, inset: FOLD_INSET, dy: -WAIST_FOLD_DEPTH },
  );
  return rows;
}

function sampleRightLeg(): Grid {
  const pos: THREE.Vector3[][] = [];
  for (const spec of rowSpecs()) {
    const row: THREE.Vector3[] = [];
    for (let j = 0; j <= N_THETA; j++) {
      const phi = (j / N_THETA) * Math.PI * 2;
      row.push(legPoint(phi, spec.t, spec.inset, spec.dy, new THREE.Vector3()));
    }
    pos.push(row);
  }
  return { pos, nrm: gridNormals(pos) };
}

export function buildShortsGeometry(): THREE.BufferGeometry {
  const acc = newAccum();
  const right = sampleRightLeg();
  // flipU: con las columnas en el sentido que deja las caras hacia afuera,
  // la U avanzaba al revés de como se ve la tela desde afuera y el molde
  // impreso salía espejado (un número se leía al revés). Invertirla deja el
  // atlas tal como se ve la prenda puesta.
  emitPiece(acc, right, 0, N_THETA, PIECE_BY_ID.shortsR.rect, { flipU: true });
  emitPiece(acc, mirrorGridX(right), 0, N_THETA, PIECE_BY_ID.shortsL.rect, {
    flipU: true,
  });
  return toBufferGeometry(acc);
}

export const SHORTS_HEIGHT = WAIST_Y;
