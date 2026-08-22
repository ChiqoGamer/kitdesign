import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * SILUETAS DE LAS PIEZAS EN EL ESPACIO UV DEL MODELO
 * ==================================================
 * Las piezas de la plantilla no son rectángulos: tienen la forma del molde,
 * con la curva de la sisa, la caída del hombro y el escote. Esa forma no hay
 * que dibujarla a mano ni copiarla de ningún lado — ES el desplegado UV del
 * GLB, así que se saca del propio modelo triangulando sus islas.
 *
 * Se calcula una sola vez y se cachea: son ~4 mil triángulos y el archivo ya
 * está en la caché del navegador porque lo carga el visor.
 *
 * Ojo con el torso: viene como una sola isla que contiene frente y espalda,
 * separados por el escote en v = 0.5. Cada triángulo se asigna por su
 * centroide, que es lo correcto para los pocos que cruzan la línea.
 */

export type PieceId = "front" | "back" | "sleeveL" | "sleeveR" | "collar";

/** Triángulos en UV, con v ya en orientación de canvas (0 = arriba). */
export type Silhouettes = Record<PieceId, Float32Array>;

const MODEL_URL = "/models/jersey-ref.glb";
const TORSO_NECK_V = 0.5;

let cache: Promise<Silhouettes> | null = null;

export function loadRefSilhouettes(): Promise<Silhouettes> {
  if (!cache) cache = build();
  return cache;
}

async function build(): Promise<Silhouettes> {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);

  const meshes: THREE.Mesh[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.getAttribute("position")) meshes.push(m);
  });
  meshes.sort(
    (a, b) =>
      b.geometry.getAttribute("position").count -
      a.geometry.getAttribute("position").count,
  );
  const geo = meshes[0].geometry;

  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const index = geo.getIndex();
  if (!uv || !index) return empty();

  // Mismo union-find que usa el remapeo: los umbrales sobre u no sirven
  // porque las islas se solapan en ese eje.
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
  for (let i = 0; i < index.count; i += 3) {
    const a = find(index.getX(i));
    const b = find(index.getX(i + 1));
    const c = find(index.getX(i + 2));
    if (a !== b) parent[b] = a;
    if (a !== c) parent[c] = a;
  }

  const groups = new Map<number, { count: number; cx: number; cy: number }>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { count: 0, cx: 0, cy: 0 }));
    g.count++;
    g.cx += pos.getX(i);
    g.cy += pos.getY(i);
  }
  const islands = [...groups.entries()]
    .filter(([, g]) => g.count > 15)
    .map(([root, g]) => ({ root, ...g, cx: g.cx / g.count, cy: g.cy / g.count }))
    .sort((a, b) => b.count - a.count);
  if (islands.length < 2) return empty();

  const torso = islands[0];
  const rest = islands.slice(1);
  const sleeves = rest
    .filter((g) => Math.abs(g.cx) > 1e-6)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  const lip = rest.filter((g) => !sleeves.includes(g)).sort((a, b) => b.cy - a.cy)[0];
  const leftSleeve = sleeves.find((s) => s.cx < 0);
  const rightSleeve = sleeves.find((s) => s.cx >= 0);

  const bucket: Record<PieceId, number[]> = {
    front: [],
    back: [],
    sleeveL: [],
    sleeveR: [],
    collar: [],
  };

  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i);
    const ib = index.getX(i + 1);
    const ic = index.getX(i + 2);
    const root = find(ia);

    let piece: PieceId | null = null;
    if (root === torso.root) {
      // Por centroide: resuelve bien los pocos triángulos que cruzan v = 0.5.
      const mv = (uv.getY(ia) + uv.getY(ib) + uv.getY(ic)) / 3;
      piece = mv >= TORSO_NECK_V ? "front" : "back";
    } else if (leftSleeve && root === leftSleeve.root) piece = "sleeveL";
    else if (rightSleeve && root === rightSleeve.root) piece = "sleeveR";
    else if (lip && root === lip.root) piece = "collar";
    if (!piece) continue;

    for (const v of [ia, ib, ic]) bucket[piece].push(uv.getX(v), uv.getY(v));
  }

  return {
    front: new Float32Array(bucket.front),
    back: new Float32Array(bucket.back),
    sleeveL: new Float32Array(bucket.sleeveL),
    sleeveR: new Float32Array(bucket.sleeveR),
    collar: new Float32Array(bucket.collar),
  };
}

function empty(): Silhouettes {
  const z = new Float32Array(0);
  return { front: z, back: z, sleeveL: z, sleeveR: z, collar: z };
}
