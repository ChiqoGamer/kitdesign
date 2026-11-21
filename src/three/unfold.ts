import * as THREE from "three";
import type { GarmentId } from "@core/index";

/**
 * DESPLEGAR LA PRENDA
 * ===================
 * La idea central del proyecto es que la UV de cada prenda ES su molde de
 * corte. Eso hace que "desplegar" sea casi gratis: cada vértice ya sabe dónde
 * cae en el molde plano, así que basta con guardar esa posición plana como
 * morph target y animar la influencia de 0 (prenda armada) a 1 (molde).
 *
 * Lo que se ve al desplegar es exactamente lo que se manda a imprimir y
 * coser, sin un renderer aparte que pueda desincronizarse.
 */

/** Metros por unidad de atlas, para que los moldes salgan a escala real. */
const FLAT_SCALE: Record<GarmentId, number> = {
  jersey: 1.0,
  shorts: 1.05,
  socks: 0.75,
};

/**
 * Dónde queda el centro de cada molde, en coordenadas de escena. Con el kit
 * completo los tres moldes quedan uno al lado del otro, como sobre una mesa
 * de corte: short a la izquierda, camiseta al centro, medias a la derecha.
 */
const FLAT_CENTER: Record<GarmentId, [number, number]> = {
  shorts: [-1.12, 0.02],
  jersey: [0, 0.02],
  socks: [1.0, 0.02],
};

export interface UnfoldInfo {
  /** Caja de la prenda armada, en espacio local. */
  foldedBox: THREE.Box3;
  /** Caja del molde plano, en espacio local. */
  flatBox: THREE.Box3;
}

/**
 * Agrega a la geometría el morph target del molde plano.
 *
 * `meshPosition` es la posición del mesh en la escena: el molde se calcula
 * en coordenadas de escena y se pasa a locales restándola.
 *
 * Las normales del molde apuntan a cámara, pero con cuidado: con DoubleSide
 * three.js da vuelta la normal de las caras que quedan de espaldas. Según
 * cómo esté orientada cada pieza en la UV, sus triángulos pueden quedar de
 * frente o de espaldas, así que se mira el sentido de cada triángulo en la
 * UV y se guarda la normal ya invertida donde hace falta. Si no, media
 * camiseta desplegada se vería negra.
 */
export function addFlatMorph(
  geometry: THREE.BufferGeometry,
  garment: GarmentId,
  meshPosition: THREE.Vector3,
): UnfoldInfo {
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const count = position.count;

  geometry.computeBoundingBox();
  const foldedBox = geometry.boundingBox!.clone();

  const scale = FLAT_SCALE[garment];
  const [cx, cy] = FLAT_CENTER[garment];
  const flat = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    flat[i * 3] = cx + (uv.getX(i) - 0.5) * scale - meshPosition.x;
    flat[i * 3 + 1] = cy + (uv.getY(i) - 0.5) * scale - meshPosition.y;
    flat[i * 3 + 2] = -meshPosition.z;
  }

  // Sentido de cada triángulo en la UV → hacia dónde tiene que mirar la normal.
  const facing = new Float32Array(count);
  const index = geometry.getIndex();
  const tri = (a: number, b: number, c: number) => {
    const area =
      (uv.getX(b) - uv.getX(a)) * (uv.getY(c) - uv.getY(a)) -
      (uv.getX(c) - uv.getX(a)) * (uv.getY(b) - uv.getY(a));
    facing[a] += area;
    facing[b] += area;
    facing[c] += area;
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      tri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
    }
  } else {
    for (let i = 0; i < count; i += 3) tri(i, i + 1, i + 2);
  }
  const flatNormal = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    flatNormal[i * 3 + 2] = facing[i] >= 0 ? 1 : -1;
  }

  const flatAttr = new THREE.Float32BufferAttribute(flat, 3);
  geometry.morphAttributes.position = [flatAttr];
  geometry.morphAttributes.normal = [
    new THREE.Float32BufferAttribute(flatNormal, 3),
  ];
  geometry.morphTargetsRelative = false;

  const flatBox = new THREE.Box3().setFromBufferAttribute(flatAttr);

  // La esfera incluye los dos estados (three la calcula con los morphs): la
  // usan el raycast y el frustum culling, que tienen que funcionar en ambos.
  geometry.computeBoundingSphere();
  // La caja, en cambio, queda la de la prenda armada; el encuadre elige
  // entre `foldedBox` y `flatBox` según el estado.
  geometry.boundingBox = foldedBox.clone();

  return { foldedBox, flatBox };
}

/** Curva suave de ida y vuelta, como un papel que se abre. */
export function easeInOut(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Orden de despliegue: la camiseta primero y después el resto, en cascada. */
export const UNFOLD_DELAY: Record<GarmentId, number> = {
  jersey: 0,
  shorts: 0.12,
  socks: 0.24,
};
