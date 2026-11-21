"use client";

import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { getViewerScene } from "./capture";

/**
 * EXPORTAR EL KIT COMO MODELO 3D
 * ==============================
 * Arma un .glb con las tres prendas y su textura tal como se ven en el
 * visor. Sirve para mandárselo al fabricante, abrirlo en Blender o verlo en
 * realidad aumentada desde el celular (los visores de AR de Android abren
 * glb directo).
 *
 * No se exporta la escena del visor tal cual, sino una copia limpia:
 *  - Sin el morph del molde plano: es un detalle del editor y duplicaría el
 *    peso del archivo.
 *  - Con material estándar de glTF (color + oclusión de vértice + tela), que
 *    cualquier visor entiende. El sheen y el clearcoat del visor son
 *    extensiones que muchos programas ignoran.
 *  - Siempre con las tres prendas, aunque el visor esté enfocado en una.
 */
export async function exportKitGlb(): Promise<Blob> {
  const scene = getViewerScene();
  if (!scene) throw new Error("Abrí la vista 3D para poder exportar el modelo.");

  const kit = new THREE.Group();
  kit.name = "Origami Design kit";

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const source = object as THREE.Mesh;
    if (!source.isMesh || !source.userData?.garment) return;
    const material = source.material as THREE.MeshPhysicalMaterial;

    const geometry = source.geometry.clone();
    geometry.morphAttributes = {};
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        name: String(source.userData.garment),
        map: material.map,
        normalMap: material.normalMap,
        normalScale: material.normalScale.clone(),
        vertexColors: true,
        roughness: material.roughness,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    mesh.name = String(source.userData.garment);
    source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    kit.add(mesh);
  });

  if (kit.children.length === 0) {
    throw new Error("Todavía no cargó el modelo. Probá de nuevo en un segundo.");
  }

  const result = await new GLTFExporter().parseAsync(kit, {
    binary: true,
    onlyVisible: false,
    maxTextureSize: 2048,
  });

  // Los materiales y geometrías copiadas no se vuelven a usar.
  kit.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });

  return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
}
