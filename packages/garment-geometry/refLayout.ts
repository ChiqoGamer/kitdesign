/**
 * LAYOUT UV DEL MODELO DE REFERENCIA
 * ==================================
 * Regiones de la plantilla de textura del editor de origen, medidas sobre
 * las UVs del propio GLB (componentes conexas) y verificadas contra su
 * plantilla:
 *
 *   rosa   = frente   → torso, mitad v > 0.5
 *   azul   = espalda  → torso, mitad v < 0.5
 *   gris   = cuello   → óvalo central
 *   verde superior = mangas cortas (las de este modelo)
 *   verde inferior = mangas largas   } sin geometría en este modelo
 *   amarillo       = mangas interiores }
 *
 * Convención glTF: v = 0 es el borde SUPERIOR de la imagen.
 *
 * Sirve para dos cosas: remapear las UVs a nuestro atlas, e importar una
 * textura ajena que venga en este layout.
 */

export interface UvRegion {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export const REF_UV_LAYOUT = {
  /** Torso completo. El escote está en v = 0.5 (desplegado "mariposa"). */
  torso: { u0: 0.3137, u1: 0.686, v0: 0.0579, v1: 0.9424 } as UvRegion,
  /** Línea del escote dentro del torso: separa frente de espalda. */
  torsoNeckV: 0.5,
  sleeveL: { u0: 0.2417, u1: 0.3596, v0: 0.0202, v1: 0.3315 } as UvRegion,
  sleeveR: { u0: 0.6406, u1: 0.7583, v0: 0.0202, v1: 0.3318 } as UvRegion,
  collar: { u0: 0.4705, u1: 0.5298, v0: 0.4915, v1: 0.5176 } as UvRegion,
} as const;

/**
 * Ubicación de la abertura del escote dentro del rectángulo del torso, en
 * coordenadas normalizadas (0..1) — el centro del ancho, sobre el borde
 * superior, con el radio del agujero medido en las UVs del archivo.
 */
export const REF_NECK_HOLE = {
  cx: 0.5,
  cy: 1.0,
  rx: 0.082,
  ry: 0.042,
};
