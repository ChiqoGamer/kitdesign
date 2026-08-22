import { GARMENT_ATLASES } from "@geom/atlas";
import type { DesignState } from "@core/types";
import { renderGarment } from "./canvas";
import { MAPPING } from "./importTexture";

/**
 * PLANTILLA DESCARGABLE DE LA CAMISETA
 * ====================================
 * Es el camino inverso de `importTexture`: toma el diseño ya pintado en
 * nuestro atlas y lo devuelve en el layout del modelo, que es el mismo que
 * espera "Importar textura".
 *
 * Por qué importa que sean el mismo layout: alguien que quiera diseñar por
 * fuera descarga esto, pinta encima y lo vuelve a subir. Si la plantilla
 * saliera en nuestro atlas interno, ese viaje de ida y vuelta no cerraría —
 * las piezas caerían en lugares distintos de los que el modelo espera.
 *
 * Las regiones se dibujan con un poco de derrame hacia afuera. Sin eso, un
 * diseño pintado justo hasta el borde se ensucia al volver: el importador
 * expande la región para llenar su propio sangrado y terminaría chupando el
 * fondo de la plantilla.
 */

/** Derrame de cada región, como fracción del lado de la plantilla. */
const SPILL = 0.004;

export function renderReferenceTemplate(
  ctx: CanvasRenderingContext2D,
  state: DesignState,
  size = 2048,
): void {
  const atlas = GARMENT_ATLASES.jersey;

  // El diseño se pinta primero en nuestro atlas y de ahí se reubica. Se usa
  // el mismo renderer que alimenta el visor, así que la plantilla muestra
  // exactamente lo que se ve en 3D.
  const source = document.createElement("canvas");
  source.width = size;
  source.height = size;
  const sctx = source.getContext("2d");
  if (!sctx) return;
  renderGarment(sctx, state, "jersey", size);

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const spill = size * SPILL;

  for (const piece of atlas.pieces) {
    const map = MAPPING[piece.id];
    if (!map) continue;

    // Origen: el rect de la pieza en nuestro atlas (Y hacia abajo en canvas).
    const sx = piece.rect.x * size;
    const sy = (1 - (piece.rect.y + piece.rect.h)) * size;
    const sw = piece.rect.w * size;
    const sh = piece.rect.h * size;

    // Destino: la región equivalente en la plantilla del modelo.
    const { region } = map;
    const dx = region.u0 * size;
    const dy = region.v0 * size;
    const dw = (region.u1 - region.u0) * size;
    const dh = (region.v1 - region.v0) * size;

    // Cuánto del origen equivale al derrame del destino.
    const px = (spill * sw) / dw;
    const py = (spill * sh) / dh;

    ctx.save();
    ctx.translate(dx + dw / 2, dy + dh / 2);
    ctx.scale(map.flipX ? -1 : 1, map.flipY ? -1 : 1);
    ctx.drawImage(
      source,
      sx - px,
      sy - py,
      sw + px * 2,
      sh + py * 2,
      -dw / 2 - spill,
      -dh / 2 - spill,
      dw + spill * 2,
      dh + spill * 2,
    );
    ctx.restore();
  }
}

/** Guías de corte, para dibujar SOBRE la plantilla y nunca dentro de ella. */
export interface TemplateGuide {
  /** Rect en fracciones del lado, con Y hacia abajo como el canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /**
   * La pieza va cabeza abajo en la plantilla y el rótulo se dibuja girado
   * para avisarlo.
   *
   * Sólo se marca la espalda, que es lo único verificado: el desplegado es
   * "mariposa" y el escote cae en el medio, así que la espalda queda
   * invertida respecto del frente. Las mangas también llevan flipY, pero ahí
   * refleja la convención de ejes entre el atlas y la plantilla, no que la
   * pieza esté al revés — afirmarlo sería inventar.
   */
  upsideDown: boolean;
}

export function referenceGuides(): TemplateGuide[] {
  const atlas = GARMENT_ATLASES.jersey;
  const guides: TemplateGuide[] = [];
  for (const piece of atlas.pieces) {
    const map = MAPPING[piece.id];
    if (!map) continue;
    const { region } = map;
    guides.push({
      x: region.u0,
      y: region.v0,
      w: region.u1 - region.u0,
      h: region.v1 - region.v0,
      label: piece.label.toUpperCase(),
      upsideDown: piece.id === "back",
    });
  }
  return guides;
}
