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
 * Abertura del escote, en coordenadas normalizadas al rectángulo del torso.
 *
 * Medido rasterizando las islas UV del propio GLB y buscando por flood fill
 * el hueco que queda sin cubrir en el centro. No está estimado a ojo: los
 * valores anteriores tenían el radio del frente a poco más de la mitad del
 * real, así que la cinta se dibujaba DENTRO del agujero, donde no hay
 * geometría que la muestre, y el cuello sólo se veía pintado por dentro.
 *
 * El frente y la espalda no comparten el radio vertical: el escote baja más
 * adelante que atrás, así que el hueco no queda centrado en la costura del
 * hombro y cada mitad necesita el suyo.
 */
export const REF_NECK_HOLE = {
  cx: 0.499,
  rx: 0.104,
  ryFront: 0.075,
  ryBack: 0.04,
};
