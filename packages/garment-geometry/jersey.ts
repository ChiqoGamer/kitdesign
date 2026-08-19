import * as THREE from "three";
import type { CollarKind, SleeveKind } from "@core/types";
import { PIECE_BY_ID, type PieceRect } from "./atlas";
import { lerp, profileAt, smoothstep, superellipse } from "./math";

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
const SUPER_N = 2.7;

const HEM_Y = 0;
const RIM_Y = 0.665; // borde superior del tubo (línea de hombro)
const NECK_Y = 0.688;
const NECK_Z = 0.012; // el escote está levemente adelantado

const YOKE_START = N_BODY / (N_BODY + N_YOKE);

/**
 * Caída del hombro. Sin esto el borde superior del tubo es un anillo
 * horizontal y la prenda parece una caja: el hombro real baja hacia la
 * sisa, y es esa pendiente la que hace que la manga calce sin muesca.
 */
const SHOULDER_SLOPE = 0.045;

/** Ancho (semieje X) del torso a lo largo de la altura. */
const WIDTH_PROFILE: [number, number][] = [
  [0.0, 0.256],
  [0.35, 0.246],
  [0.72, 0.271],
  [1.0, 0.234],
];

/** Profundidad (semieje Z) del torso. */
const DEPTH_PROFILE: [number, number][] = [
  [0.0, 0.152],
  [0.35, 0.144],
  [0.72, 0.163],
  [1.0, 0.150],
];

interface NeckShape {
  /** Caída máxima del escote al frente, en metros. */
  frontDrop: number;
  /** Caída atrás (siempre leve). */
  backDrop: number;
  /** Multiplicador del ancho del escote. */
  widthScale: number;
}

const NECK_SHAPES: Record<CollarKind, NeckShape> = {
  crew: { frontDrop: 0.030, backDrop: 0.010, widthScale: 1.0 },
  v: { frontDrop: 0.128, backDrop: 0.010, widthScale: 1.1 },
};

/** Extensión horizontal desde la sisa, en metros. */
const SLEEVE_LENGTH: Record<SleeveKind, number> = {
  sleeveless: 0.085,
  short: 0.168,
  long: 0.42,
};

const SLEEVE_DROP: Record<SleeveKind, number> = {
  sleeveless: 0.05,
  short: 0.13,
  long: 0.34,
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
  const lateral = Math.abs(Math.cos(theta)); // 0 al centro, 1 a los lados
  const towardsFront = Math.sin(theta) > 0;
  const depth = towardsFront ? shape.frontDrop : shape.backDrop;
  return depth * Math.max(0, 1 - lateral);
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

function torsoPoint(
  theta: number,
  t: number,
  shape: NeckShape,
  out: THREE.Vector3,
): THREE.Vector3 {
  const [sx, sz] = superellipse(theta, SUPER_N);

  if (t <= YOKE_START) {
    // Tubo: de dobladillo a línea de hombro.
    const u = t / YOKE_START;
    const w = profileAt(u, WIDTH_PROFILE);
    const d = profileAt(u, DEPTH_PROFILE);
    return out.set(
      w * sx,
      lerp(HEM_Y, rimY(theta, shape), u),
      d * sz,
    );
  }

  // Canesú: de la línea de hombro al escote.
  const s = (t - YOKE_START) / (1 - YOKE_START);
  // Horizontal cierra rápido y vertical sube despacio: eso redondea el
  // hombro en vez de producir un cono.
  const eh = 1 - (1 - s) * (1 - s);
  const ev = Math.pow(s, 1.8);

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

interface Grid {
  pos: THREE.Vector3[][]; // [fila][columna]
  nrm: THREE.Vector3[][];
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
// Emisión de una pieza (sub-rejilla → atributos con UV dentro de su rect)
// ---------------------------------------------------------------------------

interface Accum {
  position: number[];
  normal: number[];
  uv: number[];
  index: number[];
}

function newAccum(): Accum {
  return { position: [], normal: [], uv: [], index: [] };
}

/**
 * Emite una sub-rejilla como pieza de patrón.
 *
 * La UV se calcula por **longitud de arco**, no por índice: cada fila se
 * centra y se escala contra la fila más ancha. Eso hace que la pieza se
 * angoste arriba, igual que un molde real — y en consecuencia una raya
 * recta dibujada en el plano converge sobre el hombro, como en una
 * camiseta sublimada de verdad.
 */
function emitPiece(
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
  const rootUp = 0.122; // semieje vertical de la sisa
  const rootSide = 0.079; // semieje horizontal
  const cuffUp = isLong ? 0.059 : 0.084;
  const cuffSide = isLong ? 0.056 : 0.08;

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
  const base = acc.position.length / 3;
  center(1, c0);
  center(0.99, c1);
  axis.subVectors(c0, c1).normalize();
  acc.position.push(c0.x, c0.y, c0.z);
  acc.normal.push(axis.x, axis.y, axis.z);
  acc.uv.push(rect.x + rect.w * 0.5, rect.y + rect.h * 0.985);
  for (let j = 0; j <= SEG_R; j++) {
    const p = pos[SEG_L][j];
    acc.position.push(p.x, p.y, p.z);
    acc.normal.push(axis.x, axis.y, axis.z);
    acc.uv.push(
      rect.x + rect.w * (0.5 + 0.42 * Math.cos((j / SEG_R) * Math.PI * 2)),
      rect.y + rect.h * 0.985,
    );
  }
  for (let j = 0; j < SEG_R; j++) {
    acc.index.push(base, base + 1 + j, base + 2 + j);
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

/** Altura total, para encuadrar la cámara. */
export const JERSEY_HEIGHT = NECK_Y + 0.03;
