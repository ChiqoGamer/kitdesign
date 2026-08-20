import * as THREE from "three";
import type { CollarKind, SleeveKind } from "@core/types";
import { PIECE_BY_ID, type PieceRect } from "./atlas";
import {
  emitPiece,
  newAccum,
  pushVertex,
  toBufferGeometry,
  type Accum,
  type Grid,
} from "./surface";
import { lerp, noise2, profileAt, smoothstep, superellipse } from "./math";

/**
 * GEOMETRÍA PARAMÉTRICA DE LA CAMISETA
 * ====================================
 * Sin modelador 3D, la prenda se construye por código. Para este producto
 * no es una solución de compromiso, es la mejor opción: al generar la
 * superficie a partir de una parametrización controlo las UVs por
 * construcción, así que el atlas-como-patrón (ver atlas.ts) sale exacto
 * en vez de depender de un unwrap manual.
 *
 * Unidades: metros. Dobladillo en y=0, cuello alrededor de y=0.70.
 *
 * Estructura:
 *   - Torso: superficie de revolución deformada (loft de secciones
 *     superelípticas), partida en dos piezas UV — delantero y espalda —
 *     con la costura exactamente en el lateral, como en la prenda real.
 *   - Canesú: el tramo superior donde la sección se contrae hacia el
 *     escote. Es lo que forma el hombro.
 *   - Escote: la altura del borde superior varía con el ángulo. Un cuello
 *     en V es esa curva siendo lineal en |x|; uno redondo, la misma curva
 *     con una caída mucho menor. Un solo parámetro separa ambos.
 *   - Mangas: tubos cónicos con caída, que arrancan *dentro* del torso.
 *     Solapar en vez de recortar sisas es invisible desde afuera y ahorra
 *     una cantidad enorme de complejidad.
 *   - Cuello: perfil elíptico barrido a lo largo del borde del escote,
 *     usando el marco local (tangente/normal) para que siga la V.
 */

const N_THETA = 128; // divisiones alrededor del cuerpo (par, para partir en 2)
const N_BODY = 30; // filas del tubo
const N_YOKE = 14; // filas del canesú
const SUPER_N = 2.06;

const HEM_Y = 0;
/** Caída del ruedo en los laterales (shirt-tail sutil), en metros. */
const HEM_SIDE_DROP = 0.012;
const RIM_Y = 0.665; // borde superior del tubo (línea de hombro)
const NECK_Y = 0.688;
const NECK_Z = 0.012; // el escote está levemente adelantado

const YOKE_START = N_BODY / (N_BODY + N_YOKE);

/**
 * Caída del hombro. Sin esto el borde superior del tubo es un anillo
 * horizontal y la prenda parece una caja: el hombro real baja hacia la
 * sisa, y es esa pendiente la que hace que la manga calce sin muesca.
 */
const SHOULDER_SLOPE = 0.058;

/** Ancho (semieje X) del torso a lo largo de la altura. */
const WIDTH_PROFILE: [number, number][] = [
  [0.0, 0.234], // ruedo — leve campana
  [0.30, 0.206], // cintura — claramente más angosta
  [0.68, 0.258], // pecho — lo más ancho
  [1.0, 0.222], // base del hombro
];

/** Profundidad (semieje Z) del torso. */
const DEPTH_PROFILE: [number, number][] = [
  [0.0, 0.132],
  [0.30, 0.121],
  [0.68, 0.155],
  [1.0, 0.14],
];

interface NeckShape {
  /** Caída máxima del escote al frente, en metros. */
  frontDrop: number;
  /** Caída atrás (siempre leve). */
  backDrop: number;
  /** Multiplicador del ancho del escote. */
  widthScale: number;
  /** true = escote en punta (V); false = redondo, sin pico al frente. */
  pointed: boolean;
}

const NECK_SHAPES: Record<CollarKind, NeckShape> = {
  crew: { frontDrop: 0.034, backDrop: 0.012, widthScale: 0.94, pointed: false },
  v: { frontDrop: 0.128, backDrop: 0.010, widthScale: 1.1, pointed: true },
};

/** Extensión horizontal desde la sisa, en metros. */
const SLEEVE_LENGTH: Record<SleeveKind, number> = {
  sleeveless: 0.085,
  short: 0.178,
  long: 0.42,
};

const SLEEVE_DROP: Record<SleeveKind, number> = {
  sleeveless: 0.05,
  short: 0.16,
  long: 0.36,
};

// ---------------------------------------------------------------------------
// Torso
// ---------------------------------------------------------------------------

/**
 * Perfil del escote: cuánto baja el borde en función del ángulo.
 * Es lineal en |cos θ| — y como x ≈ W·cos θ, eso significa lineal en |x|,
 * que es exactamente lo que dibuja una V. El cuello redondo usa la misma
 * fórmula con una caída chica.
 */
function neckDrop(theta: number, shape: NeckShape): number {
  const towardsFront = Math.sin(theta) > 0;
  const depth = towardsFront ? shape.frontDrop : shape.backDrop;
  if (shape.pointed) {
    // V: lineal en |cos θ| ≈ lineal en |x| → punta al frente.
    return depth * Math.max(0, 1 - Math.abs(Math.cos(theta)));
  }
  // Redondo: bump sin² → escote ovalado suave, sin pico ni esquinas.
  const f = Math.abs(Math.sin(theta)); // 0 al lado, 1 al frente/espalda
  return depth * f * f;
}

/** Altura del borde superior del tubo (baja junto con el escote). */
function rimY(theta: number, shape: NeckShape): number {
  return (
    RIM_Y -
    SHOULDER_SLOPE * Math.abs(Math.cos(theta)) -
    neckDrop(theta, shape) * 0.55
  );
}

/** Altura del borde del escote. */
function neckY(theta: number, shape: NeckShape): number {
  return NECK_Y - neckDrop(theta, shape);
}

/**
 * Arrugas de tela: desplazamiento radial con ruido suave, alargado en
 * vertical (los pliegues de una camiseta colgada caen a lo largo, no a lo
 * ancho). Es lo que separa "globo perfecto" de "prenda": la silueta deja
 * de ser una curva matemática. La amplitud se apaga hacia el canesú para
 * que hombro y escote queden limpios, y sube un poco hacia el ruedo.
 */
function wrinkle(theta: number, t: number): number {
  const around = theta / (Math.PI * 2);
  const folds =
    noise2(around * 9, t * 2.6) * 0.7 + noise2(around * 21, t * 5.2) * 0.3;
  const envelope =
    (1 - smoothstep((t - 0.55) / 0.32)) * (0.6 + 0.25 * (1 - t));
  return folds * envelope * 0.006;
}

function torsoPoint(
  theta: number,
  t: number,
  shape: NeckShape,
  out: THREE.Vector3,
): THREE.Vector3 {
  const [sx, sz0] = superellipse(theta, SUPER_N);
  // Asimetría pecho/espalda: el frente es más profundo y redondo, la
  // espalda más plana. Es lo que da la lectura de "hay un cuerpo adentro"
  // en vez de un tubo simétrico. sz0>0 mira al frente.
  const sz = sz0 > 0 ? sz0 * 1.08 : sz0 * 0.9;
  const disp = 1 + wrinkle(theta, t) / 0.25; // relativo al radio medio

  if (t <= YOKE_START) {
    // Tubo: de dobladillo a línea de hombro.
    const u = t / YOKE_START;
    const w = profileAt(u, WIDTH_PROFILE);
    const d = profileAt(u, DEPTH_PROFILE);
    return out.set(
      w * sx * disp,
      lerp(HEM_Y - HEM_SIDE_DROP * Math.cos(theta) * Math.cos(theta), rimY(theta, shape), u),
      d * sz * disp,
    );
  }

  // Canesú: de la línea de hombro al escote.
  const s = (t - YOKE_START) / (1 - YOKE_START);
  // Horizontal cierra y vertical sube, ambos con derivada 0 en la línea del
  // hombro: sin ese C1 aparece un pliegue duro (la "esquina" del hombro).
  // eh (smoothstep) cierra más que ev al principio → repisa de hombro
  // redondeada que después curva hacia el escote.
  const eh = s * s * (3 - 2 * s);
  const ev = s * s * (2 - s) * 0.5 + s * s * s * 0.5;

  const w1 = profileAt(1, WIDTH_PROFILE);
  const d1 = profileAt(1, DEPTH_PROFILE);

  /**
   * Donde el escote baja, se lo acerca a la superficie del pecho para que
   * la V no "hunda" el torso — pero SÓLO en profundidad. Aplicarlo también
   * al ancho inflaba la abertura y la V terminaba leyéndose como un escote
   * redondo ancho.
   */
  const dropRatio =
    neckDrop(theta, shape) / Math.max(shape.frontDrop, 1e-6);
  const nw = 0.077 * shape.widthScale;
  const nd = lerp(0.093, d1, dropRatio * 0.88);

  return out.set(
    lerp(w1 * sx, nw * sx, eh),
    lerp(rimY(theta, shape), neckY(theta, shape), ev),
    lerp(d1 * sz, nd * sz + NECK_Z, eh),
  );
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _dTheta = new THREE.Vector3();
const _dT = new THREE.Vector3();

/** Normal analítica: evita costuras de sombreado entre delantero y espalda. */
function torsoNormal(
  theta: number,
  t: number,
  shape: NeckShape,
  out: THREE.Vector3,
): THREE.Vector3 {
  const h = 1e-4;
  torsoPoint(theta + h, t, shape, _a);
  torsoPoint(theta - h, t, shape, _b);
  _dTheta.subVectors(_a, _b);
  torsoPoint(theta, Math.min(1, t + h), shape, _a);
  torsoPoint(theta, Math.max(0, t - h), shape, _b);
  _dT.subVectors(_a, _b);
  return out.crossVectors(_dT, _dTheta).normalize();
}

function sampleTorso(shape: NeckShape): Grid {
  const rows = N_BODY + N_YOKE;
  const pos: THREE.Vector3[][] = [];
  const nrm: THREE.Vector3[][] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const pr: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let j = 0; j <= N_THETA; j++) {
      const theta = (j / N_THETA) * Math.PI * 2;
      pr.push(torsoPoint(theta, t, shape, new THREE.Vector3()));
      nr.push(torsoNormal(theta, t, shape, new THREE.Vector3()));
    }
    pos.push(pr);
    nrm.push(nr);
  }
  return { pos, nrm };
}

// ---------------------------------------------------------------------------
// Mangas
// ---------------------------------------------------------------------------

function emitSleeve(
  acc: Accum,
  side: 1 | -1,
  kind: SleeveKind,
  rect: PieceRect,
): void {
  const len = SLEEVE_LENGTH[kind];
  const drop = SLEEVE_DROP[kind];
  const SEG_L = kind === "long" ? 26 : 16;
  const SEG_R = 44;

  /**
   * La raíz de la manga es una elipse tipo sisa (más alta que ancha),
   * ubicada *dentro* del torso y a la altura justa para que su borde
   * superior coincida con la punta del hombro. Solapar en vez de recortar
   * la sisa es invisible desde afuera y evita toda la maquinaria de
   * booleanas sobre la malla.
   */
  const rootX = side * 0.185;
  const rootY = 0.515;
  const rootZ = 0.0;

  const isLong = kind === "long";
  const rootUp = 0.116; // semieje vertical de la sisa
  const rootSide = 0.075; // semieje horizontal
  const cuffUp = isLong ? 0.055 : 0.07;
  const cuffSide = isLong ? 0.052 : 0.066;

  const center = (k: number, out: THREE.Vector3) =>
    out.set(
      rootX + side * len * k,
      rootY - drop * Math.pow(k, 1.5),
      rootZ - 0.022 * k,
    );

  const axis = new THREE.Vector3();
  const eSide = new THREE.Vector3();
  const eUp = new THREE.Vector3();
  const c0 = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  const pos: THREE.Vector3[][] = [];
  const nrm: THREE.Vector3[][] = [];

  for (let i = 0; i <= SEG_L; i++) {
    const k = i / SEG_L;
    center(Math.max(0, k - 0.005), c0);
    center(Math.min(1, k + 0.005), c1);
    axis.subVectors(c1, c0).normalize();
    eSide.crossVectors(axis, worldUp).normalize();
    eUp.crossVectors(eSide, axis).normalize();
    center(k, c0);

    const e = smoothstep(k);
    // Leve panza en el bíceps: una manga perfectamente cónica se ve rígida.
    const bulge = 1 + 0.045 * Math.sin(Math.PI * k);
    const ru = lerp(rootUp, cuffUp, e) * bulge;
    const rs = lerp(rootSide, cuffSide, e) * bulge;

    const pr: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let j = 0; j <= SEG_R; j++) {
      const a = (j / SEG_R) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      pr.push(
        new THREE.Vector3()
          .copy(c0)
          .addScaledVector(eSide, rs * ca)
          .addScaledVector(eUp, ru * sa),
      );
      // Normal de una elipse: hay que escalar por el radio opuesto.
      nr.push(
        new THREE.Vector3()
          .addScaledVector(eSide, ca * ru)
          .addScaledVector(eUp, sa * rs)
          .normalize(),
      );
    }
    pos.push(pr);
    nrm.push(nr);
  }

  emitPiece(acc, { pos, nrm }, 0, SEG_R, rect, { flipU: side < 0 });

  // Tapa del puño, para que no se vea el interior del tubo.
  center(1, c0);
  center(0.99, c1);
  axis.subVectors(c0, c1).normalize();
  const capCenter = pushVertex(
    acc,
    c0,
    axis,
    rect.x + rect.w * 0.5,
    rect.y + rect.h * 0.985,
    0.6,
  );
  for (let j = 0; j <= SEG_R; j++) {
    const p = pos[SEG_L][j];
    pushVertex(
      acc,
      p,
      axis,
      rect.x + rect.w * (0.5 + 0.42 * Math.cos((j / SEG_R) * Math.PI * 2)),
      rect.y + rect.h * 0.985,
      0.62,
    );
  }
  for (let j = 0; j < SEG_R; j++) {
    acc.index.push(capCenter, capCenter + 1 + j, capCenter + 2 + j);
  }
}

// ---------------------------------------------------------------------------
// Cuello
// ---------------------------------------------------------------------------

function emitCollar(acc: Accum, grid: Grid, rect: PieceRect): void {
  const rim = grid.pos[grid.pos.length - 1];
  const rimN = grid.nrm[grid.nrm.length - 1];
  const SEG_A = 14;
  const RU = 0.0088;
  const RV = 0.0108;

  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const center = new THREE.Vector3();

  const pos: THREE.Vector3[][] = [];
  const nrm: THREE.Vector3[][] = [];

  for (let j = 0; j <= N_THETA; j++) {
    const prev = rim[(j - 1 + N_THETA) % N_THETA];
    const next = rim[(j + 1) % N_THETA];
    tangent.subVectors(next, prev).normalize();
    normal.copy(rimN[j % N_THETA]).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    // Reortogonaliza para que el marco siga la inclinación de la V.
    normal.crossVectors(binormal, tangent).normalize();
    center.copy(rim[j]).addScaledVector(normal, RU * 0.35);

    const pr: THREE.Vector3[] = [];
    const nr: THREE.Vector3[] = [];
    for (let i = 0; i <= SEG_A; i++) {
      const a = (i / SEG_A) * Math.PI * 2;
      const n = new THREE.Vector3()
        .addScaledVector(normal, Math.cos(a))
        .addScaledVector(binormal, Math.sin(a))
        .normalize();
      pr.push(
        new THREE.Vector3()
          .copy(center)
          .addScaledVector(normal, RU * Math.cos(a))
          .addScaledVector(binormal, RV * Math.sin(a)),
      );
      nr.push(n);
    }
    pos.push(pr);
    nrm.push(nr);
  }

  // Barrido: filas = vuelta al escote, columnas = sección del cordón.
  emitPiece(acc, { pos, nrm }, 0, SEG_A, rect);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export interface JerseyOptions {
  collar: CollarKind;
  sleeve: SleeveKind;
}

/**
 * Construye la camiseta completa como una única BufferGeometry.
 * Un solo mesh y un solo material: el detalle vive en la textura, no en la
 * geometría, así que corre bien incluso en una tablet vieja.
 */
export function buildJerseyGeometry(opts: JerseyOptions): THREE.BufferGeometry {
  const shape = NECK_SHAPES[opts.collar];
  const grid = sampleTorso(shape);
  const acc = newAccum();

  const half = N_THETA / 2;
  // θ ∈ [0, π] → mitad delantera; θ ∈ [π, 2π] → espalda.
  // Los vértices de la costura se duplican a propósito: son dos piezas.
  emitPiece(acc, grid, 0, half, PIECE_BY_ID.front.rect, { flipU: true });
  emitPiece(acc, grid, half, N_THETA, PIECE_BY_ID.back.rect, { flipU: true });

  emitSleeve(acc, 1, opts.sleeve, PIECE_BY_ID.sleeveR.rect);
  emitSleeve(acc, -1, opts.sleeve, PIECE_BY_ID.sleeveL.rect);
  emitCollar(acc, grid, PIECE_BY_ID.collar.rect);

  return toBufferGeometry(acc);
}

/** Altura total, para encuadrar la cámara. */
export const JERSEY_HEIGHT = NECK_Y + 0.03;
