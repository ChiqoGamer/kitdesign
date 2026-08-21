import * as THREE from "three";
import { PIECE_BY_ID } from "@geom/atlas";
import { REF_NECK_HOLE } from "@geom/refLayout";

/**
 * MALLA DE REFERENCIA (GLB)
 * =========================
 * Camiseta low-poly de un editor open source (4.440 vértices, 8.274 tris).
 * Se integra remapeando SUS UVs a NUESTRO atlas, así patrones, paneles,
 * logos y números siguen funcionando sin tocar los painters.
 *
 * El layout se derivó del propio archivo con análisis de componentes
 * conexas sobre las UVs, y coincide con la plantilla de textura del editor
 * de origen (confirmado contra ella pieza por pieza):
 *
 *   torso     u 0.314–0.686  v 0.058–0.942   (2734 vértices)
 *   manga izq u 0.242–0.360  v 0.020–0.332   ( 814)
 *   manga der u 0.641–0.758  v 0.020–0.332   ( 814)
 *   cuello    u 0.471–0.530  v 0.492–0.518   (  78)  ← sólo el borde interno
 *
 * En la plantilla del editor de origen (v=0 arriba, convención glTF):
 *   rosa   = frente         → mitad v>0.5 del torso
 *   azul   = espalda        → mitad v<0.5 del torso
 *   gris   = cuello         → el óvalo central, la isla de 78 vértices
 *   verde superior = mangas cortas  → las dos islas de manga de ESTE modelo
 *   verde inferior = mangas largas  → sin geometría acá (modelo de manga corta)
 *   amarillo       = mangas interiores → tampoco existen en este modelo
 *
 * Las regiones sin geometría quedan sin usar y no hace falta pintarlas. Si
 * más adelante se carga la variante de manga larga, sus islas caerán en el
 * verde inferior y la clasificación por isla las detecta igual (se ubican
 * por su centro en X, no por rangos fijos).
 *
 * Orientación del torso, confirmada midiendo la geometría:
 *   - v = 0.5 es el ESCOTE (y máxima); v→0.94 baja al ruedo delantero y
 *     v→0.06 al ruedo trasero (desplegado "mariposa").
 *   - v > 0.5 es el FRENTE (z medio +), v < 0.5 la ESPALDA (z medio −).
 *
 * CINTA DE CUELLO
 * ---------------
 * La isla de cuello es sólo el borde interior del escote; la cinta visible
 * por fuera pertenece al torso. Reclasificar geometría para pintarla no
 * funciona: por vértice mancha la textura (triángulos con vértices en dos
 * zonas) y por triángulo deja el borde aserrado sobre una malla low-poly.
 *
 * Por eso la cinta se PINTA en el atlas (ver design-render/canvas.ts):
 * como el torso se normaliza con el escote en la fila superior de su
 * rectángulo, la abertura queda siempre en un lugar conocido y se puede
 * dibujar un anillo de borde suave y grosor exacto. Acá sólo se exporta
 * dónde quedó esa abertura.
 */

/**
 * Ubicación de la abertura del escote dentro del rectángulo del torso, en
 * coordenadas normalizadas (0..1), derivada de las islas del modelo:
 * centro en el medio del ancho y en el borde superior (el escote), con el
 * radio del agujero medido sobre las UVs del propio archivo.
 */
export { REF_NECK_HOLE };

type Zone = "torso" | "sleeveL" | "sleeveR" | "collar";

interface Island {
  verts: number[];
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  cx: number;
  cy: number;
}

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
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = find(index.getX(i));
      const b = find(index.getX(i + 1));
      const c = find(index.getX(i + 2));
      if (a !== b) parent[b] = a;
      if (a !== c) parent[c] = a;
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

const norm = (x: number, a: number, b: number) =>
  b - a < 1e-9 && b - a > -1e-9 ? 0 : Math.min(1, Math.max(0, (x - a) / (b - a)));

/**
 * Convierte el GLB en una geometría lista para el editor: LOD más
 * detallado, sin skinning, UVs remapeadas a nuestro atlas con cinta de
 * cuello prolija, y alineada a la convención del kit (origen en el ruedo).
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

  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (uv) {
    const islands = findIslands(geo);
    const torso = islands[0];
    const rest = islands.slice(1);
    const sleeves = rest
      .filter((g) => Math.abs(g.cx) > 1e-6)
      .sort((a, b) => b.verts.length - a.verts.length)
      .slice(0, 2);
    const lip = rest
      .filter((g) => !sleeves.includes(g))
      .sort((a, b) => b.cy - a.cy)[0];

    const front = PIECE_BY_ID.front.rect;
    const back = PIECE_BY_ID.back.rect;

    // Torso: escote en la fila superior del rect, ruedos abajo.
    for (const i of torso.verts) {
      const v = uv.getY(i);
      const isFront = v >= 0.5;
      const r = isFront ? front : back;
      const fv = isFront ? norm(v, torso.v1, 0.5) : norm(v, torso.v0, 0.5);
      const raw = norm(uv.getX(i), torso.u0, torso.u1);
      const fu = isFront ? raw : 1 - raw;
      uv.setXY(i, r.x + fu * r.w, r.y + fv * r.h);
    }

    /**
     * Mangas. La izquierda se invierte en u igual que en la geometría
     * procedural (que usa flipU para ese lado): así ambas mallas comparten
     * la misma convención de atlas y el flag `mirror` de los anclajes vale
     * para las dos. Si no, cada malla necesitaría un valor distinto y el
     * anclaje dejaría de ser independiente del modelo.
     */
    for (const g of sleeves) {
      const isLeft = g.cx < 0;
      const r = isLeft ? PIECE_BY_ID.sleeveL.rect : PIECE_BY_ID.sleeveR.rect;
      for (const i of g.verts) {
        const raw = norm(uv.getX(i), g.u0, g.u1);
        const fu = isLeft ? 1 - raw : raw;
        uv.setXY(i, r.x + fu * r.w, r.y + norm(uv.getY(i), g.v0, g.v1) * r.h);
      }
    }

    // Borde interior del escote: toma el color del cuello.
    if (lip) {
      const r = PIECE_BY_ID.collar.rect;
      for (const i of lip.verts) {
        uv.setXY(
          i,
          r.x + norm(uv.getX(i), lip.u0, lip.u1) * r.w,
          r.y + norm(uv.getY(i), lip.v0, lip.v1) * r.h,
        );
      }
    }
    uv.needsUpdate = true;

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[REF] islas=${islands.length} torso=${torso.verts.length}` +
          ` mangas=${sleeves.map((g) => g.verts.length).join("/")}` +
          ` bordeEscote=${lip ? lip.verts.length : "no"}`,
      );
    }
  }

  // Alinear a la convención del kit: origen en el ruedo, centrado en X/Z.
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  geo.translate(-center.x, -box.min.y, -center.z);
  const s = targetHeight / size.y;
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
