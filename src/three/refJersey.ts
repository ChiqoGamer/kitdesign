import * as THREE from "three";
import { PIECE_BY_ID } from "@geom/atlas";

/**
 * MALLA DE REFERENCIA (GLB)
 * =========================
 * Camiseta low-poly de un editor open source (4.440 vértices, UVs limpias).
 * Se integra remapeando SUS UVs a NUESTRO atlas, de modo que todo lo ya
 * construido (patrones por zona, paneles, logos, números) siga funcionando
 * sin tocar los painters.
 *
 * Islas UV del modelo (confirmadas con una cuadrícula de diagnóstico):
 *   - Torso: u ∈ [0.375, 0.625] — frente v > 0.5, espalda v < 0.5
 *   - Manga izquierda: u < 0.375
 *   - Manga derecha:   u > 0.625
 * No trae banda de cuello separada: el escote es borde del torso.
 *
 * Nota sobre la pose: el GLB viene con esqueleto, pero sus vértices ya
 * están en la forma correcta de la prenda (proporciones ancho/alto 1.07,
 * profundidad/alto 0.42). Por eso se usan tal cual y NO se aplica el
 * matrixWorld del nodo: hacerlo mezclaba transforms de huesos y aplastaba
 * la camiseta.
 */

const TORSO_U0 = 0.375;
const TORSO_U1 = 0.625;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Reescribe las UVs para que indexen nuestro atlas de camiseta. */
export function remapToAtlas(geo: THREE.BufferGeometry): void {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return;

  const front = PIECE_BY_ID.front.rect;
  const back = PIECE_BY_ID.back.rect;
  const sleeveL = PIECE_BY_ID.sleeveL.rect;
  const sleeveR = PIECE_BY_ID.sleeveR.rect;

  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    let rect = front;
    let fu: number;
    let fv: number;

    if (u < TORSO_U0) {
      rect = sleeveL;
      fu = clamp01(u / TORSO_U0);
      fv = clamp01(v);
    } else if (u > TORSO_U1) {
      rect = sleeveR;
      fu = clamp01((u - TORSO_U1) / (1 - TORSO_U1));
      fv = clamp01(v);
    } else {
      fu = clamp01((u - TORSO_U0) / (TORSO_U1 - TORSO_U0));
      if (v >= 0.5) {
        rect = front;
        fv = clamp01((v - 0.5) / 0.5);
      } else {
        rect = back;
        fv = clamp01((0.5 - v) / 0.5);
      }
    }

    uv.setXY(i, rect.x + fu * rect.w, rect.y + fv * rect.h);
  }
  uv.needsUpdate = true;
}

/**
 * Extrae la camiseta del GLB como geometría lista para usar: LOD más
 * detallado, sin skinning, con las UVs remapeadas y normalizada en altura
 * y centro.
 */
export function prepareRefGeometry(
  source: THREE.Object3D,
  targetHeight = 0.66,
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
  // El rig no se usa: la prenda ya está en su forma final.
  geo.deleteAttribute("skinIndex");
  geo.deleteAttribute("skinWeight");

  /**
   * El material del kit usa vertexColors para la oclusión horneada. El GLB
   * trae su propio COLOR_0 (que sale negro) — se reemplaza por blanco
   * neutro para no oscurecer la textura de diseño.
   */
  const vcount = geo.getAttribute("position").count;
  const white = new Float32Array(vcount * 3).fill(1);
  geo.setAttribute("color", new THREE.BufferAttribute(white, 3));

  remapToAtlas(geo);

  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  geo.translate(-center.x, -center.y, -center.z);
  const scale = targetHeight / size.y;
  geo.scale(scale, scale, scale);

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
