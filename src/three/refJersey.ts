import * as THREE from "three";
import { PIECE_BY_ID } from "@geom/atlas";

/**
 * MALLA DE REFERENCIA (GLB)
 * =========================
 * Camiseta low-poly de un editor open source (4.440 vértices, 8.274 tris).
 * Se integra remapeando SUS UVs a NUESTRO atlas, así patrones, paneles,
 * logos y números siguen funcionando sin tocar los painters.
 *
 * El layout se derivó del propio archivo con análisis de componentes
 * conexas sobre las UVs (no por umbrales, que fallaban porque las mangas
 * se solapan en u con el torso). Son 4 islas:
 *
 *   torso     u 0.314–0.686  v 0.058–0.942   (2734 vértices)
 *   manga izq u 0.242–0.360  v 0.020–0.332   ( 814)
 *   manga der u 0.641–0.758  v 0.020–0.332   ( 814)
 *   cuello    u 0.471–0.530  v 0.492–0.518   (  78)
 *
 * Orientación del torso, confirmada midiendo la geometría:
 *   - v = 0.5 es el ESCOTE (y máxima); v→0.94 baja al ruedo delantero y
 *     v→0.06 al ruedo trasero. Es un desplegado "mariposa".
 *   - v > 0.5 es el FRENTE (z medio +), v < 0.5 la ESPALDA (z medio −).
 *   - u crece de −x a +x.
 *
 * Cuello: la isla de 78 vértices es sólo el BORDE INTERIOR del escote, así
 * que pintarla dejaba la cinta exterior sin color (se veía el patrón del
 * cuerpo). La cinta visible pertenece a la isla del torso, de modo que se
 * reclasifica como cuello un anillo de vértices del torso alrededor de la
 * abertura, medido por distancia 3D al borde.
 */

interface Island {
  verts: number[];
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  cx: number;
  cy: number;
}

/** Agrupa vértices en islas UV por componentes conexas de la malla. */
function findIslands(geo: THREE.BufferGeometry): Island[] {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const index = geo.getIndex();
  const n = pos.count;

  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      union(index.getX(i), index.getX(i + 1));
      union(index.getX(i + 1), index.getX(i + 2));
    }
  }

  const map = new Map<number, Island>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let g = map.get(root);
    if (!g) {
      g = { verts: [], u0: 1, u1: 0, v0: 1, v1: 0, cx: 0, cy: 0 };
      map.set(root, g);
    }
    const u = uv.getX(i);
    const v = uv.getY(i);
    g.verts.push(i);
    g.u0 = Math.min(g.u0, u);
    g.u1 = Math.max(g.u1, u);
    g.v0 = Math.min(g.v0, v);
    g.v1 = Math.max(g.v1, v);
    g.cx += pos.getX(i);
    g.cy += pos.getY(i);
  }

  const list = [...map.values()].filter((g) => g.verts.length > 15);
  for (const g of list) {
    g.cx /= g.verts.length;
    g.cy /= g.verts.length;
  }
  return list.sort((a, b) => b.verts.length - a.verts.length);
}

/**
 * Ancho de la cinta de cuello, como fracción de la altura de la prenda.
 * ~4% equivale a unos 2 cm en una camiseta real.
 */
const COLLAR_BAND = 0.04;

const norm = (x: number, a: number, b: number) =>
  b - a < 1e-6 ? 0 : Math.min(1, Math.max(0, (x - a) / (b - a)));

/** Reescribe las UVs para que indexen nuestro atlas de camiseta. */
export function remapToAtlas(geo: THREE.BufferGeometry): void {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return;

  const islands = findIslands(geo);
  if (islands.length === 0) return;

  // Clasificación: la más grande es el torso; las dos gemelas con centro X
  // simétrico son las mangas (el signo dice el lado); la chica más alta es
  // el cuello.
  const torso = islands[0];
  const rest = islands.slice(1);
  const sleeves = rest
    .filter((g) => Math.abs(g.cx) > 1e-5)
    .sort((a, b) => b.verts.length - a.verts.length)
    .slice(0, 2);
  const collar = rest
    .filter((g) => !sleeves.includes(g))
    .sort((a, b) => b.cy - a.cy)[0];

  const front = PIECE_BY_ID.front.rect;
  const back = PIECE_BY_ID.back.rect;
  const collarRect = PIECE_BY_ID.collar.rect;

  /**
   * Anillo de cuello: se toman los vértices del torso cercanos al borde del
   * escote y se los manda a la pieza de cuello, para que la cinta se vea
   * pintada por fuera y no sólo por dentro.
   */
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const collarSet = new Set<number>();
  let neckCx = 0;
  let neckCz = 0;
  let bandWidth = 0;

  if (collar) {
    for (const i of collar.verts) {
      neckCx += pos.getX(i);
      neckCz += pos.getZ(i);
    }
    neckCx /= collar.verts.length;
    neckCz /= collar.verts.length;

    geo.computeBoundingBox();
    const h = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
    bandWidth = h * COLLAR_BAND;

    for (const i of torso.verts) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      let best = Infinity;
      for (const j of collar.verts) {
        const dx = x - pos.getX(j);
        const dy = y - pos.getY(j);
        const dz = z - pos.getZ(j);
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
      }
      if (Math.sqrt(best) < bandWidth) collarSet.add(i);
    }
  }

  const collarUv = (i: number, d: number) => {
    // Alrededor del escote → u; distancia al borde → v (cinta radial).
    const ang = Math.atan2(pos.getZ(i) - neckCz, pos.getX(i) - neckCx);
    const fu = (ang + Math.PI) / (Math.PI * 2);
    const fv = bandWidth > 0 ? Math.min(1, d / bandWidth) : 0;
    uv.setXY(
      i,
      collarRect.x + fu * collarRect.w,
      collarRect.y + fv * collarRect.h,
    );
  };

  // --- Torso: escote en v=0.5, ruedos en los extremos ---
  for (const i of torso.verts) {
    if (collarSet.has(i)) {
      // Recalcular la distancia sólo para el mapeo de la cinta.
      let best = Infinity;
      if (collar) {
        for (const j of collar.verts) {
          const dx = pos.getX(i) - pos.getX(j);
          const dy = pos.getY(i) - pos.getY(j);
          const dz = pos.getZ(i) - pos.getZ(j);
          const d = dx * dx + dy * dy + dz * dz;
          if (d < best) best = d;
        }
      }
      collarUv(i, Math.sqrt(best));
      continue;
    }
    const u = uv.getX(i);
    const v = uv.getY(i);
    const isFront = v >= 0.5;
    const rect = isFront ? front : back;
    // fv: 0 = ruedo, 1 = escote (igual que nuestras piezas).
    const fv = isFront ? norm(v, torso.v1, 0.5) : norm(v, torso.v0, 0.5);
    // El frente se lee con +x a la derecha; la espalda va espejada.
    const raw = norm(u, torso.u0, torso.u1);
    const fu = isFront ? raw : 1 - raw;
    uv.setXY(i, rect.x + fu * rect.w, rect.y + fv * rect.h);
  }

  // --- Mangas: cada isla a su pieza, según el lado ---
  for (const g of sleeves) {
    const rect = g.cx > 0 ? PIECE_BY_ID.sleeveR.rect : PIECE_BY_ID.sleeveL.rect;
    for (const i of g.verts) {
      const fu = norm(uv.getX(i), g.u0, g.u1);
      const fv = norm(uv.getY(i), g.v0, g.v1);
      uv.setXY(i, rect.x + fu * rect.w, rect.y + fv * rect.h);
    }
  }

  // --- Borde interior del escote: también es cuello ---
  if (collar) {
    for (const i of collar.verts) collarUv(i, 0);
  }

  uv.needsUpdate = true;

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[REF] islas=${islands.length} torso=${torso.verts.length}` +
        ` mangas=${sleeves.map((s) => s.verts.length).join("/")}` +
        ` cuelloBorde=${collar ? collar.verts.length : "no"}` +
        ` cintaCuello=${collarSet.size}`,
    );
  }
}

/**
 * Extrae la camiseta del GLB lista para usar: LOD más detallado, sin
 * skinning, UVs remapeadas y alineada a la MISMA convención que la
 * geometría procedural (origen en el ruedo, alto 0.688) para compartir el
 * layout del kit.
 */
export function prepareRefGeometry(
  source: THREE.Object3D,
  targetHeight = 0.688,
): THREE.BufferGeometry {
  const meshes: THREE.Mesh[] = [];
  source.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.getAttribute("position")) meshes.push(m);
  });
  meshes.sort(
    (a, b) =>
      b.geometry.getAttribute("position").count -
      a.geometry.getAttribute("position").count,
  );

  const geo = meshes[0].geometry.clone();
  // El rig no se usa: la prenda ya viene en su forma final.
  geo.deleteAttribute("skinIndex");
  geo.deleteAttribute("skinWeight");

  // El material del kit usa vertexColors para su propia oclusión; el
  // COLOR_0 del asset viene negro y apagaría la textura.
  const vcount = geo.getAttribute("position").count;
  geo.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(vcount * 3).fill(1), 3),
  );

  remapToAtlas(geo);

  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  geo.translate(-center.x, -box.min.y, -center.z);
  geo.scale(targetHeight / size.y, targetHeight / size.y, targetHeight / size.y);

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
