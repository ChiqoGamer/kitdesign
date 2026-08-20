"use client";

import { Suspense, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { makeUvGrid } from "./UvGrid";
import { analyzeMesh } from "./analyze";

/**
 * Diagnóstico del GLB de referencia: carga el LOD más detallado con una
 * cuadrícula UV para confirmar cómo están desplegadas las islas antes de
 * integrarlo al editor.
 */
function Model() {
  const { scene } = useGLTF("/models/jersey-ref.glb");
  const grid = useMemo(() => makeUvGrid(), []);

  const model = useMemo(() => {
    // Se buscan las mallas y se queda con la de más vértices (LOD 0).
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    meshes.sort(
      (a, b) =>
        (b.geometry.getAttribute("position")?.count ?? 0) -
        (a.geometry.getAttribute("position")?.count ?? 0),
    );
    const src = meshes[0];
    const geo = src.geometry.clone();
    geo.computeVertexNormals();
    console.log("[ANALYZE]\n" + analyzeMesh(geo).join("\n"));

    // Mesh nuevo, sin skeleton: no necesitamos el rig.
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: grid,
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
    );
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = 1.5 / Math.max(size.x, size.y, size.z);
    mesh.scale.setScalar(s);
    mesh.position.set(-center.x * s, -center.y * s, -center.z * s);
    console.log(
      `[GLB] verts=${geo.getAttribute("position").count} size=${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)}`,
    );
    return mesh;
  }, [scene, grid]);

  return <primitive object={model} />;
}

export default function FbxTest() {
  return (
    <div style={{ height: "100vh", background: "#15181e" }}>
      <Canvas camera={{ position: [0, 0, 2.4], fov: 35 }}>
        <color attach="background" args={["#15181e"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 3]} intensity={1.1} />
        <directionalLight position={[-2, 1, -3]} intensity={0.5} />
        <Suspense fallback={null}>
          <Model />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
