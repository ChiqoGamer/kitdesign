/**
 * Registro de imágenes subidas (escudos, sponsors).
 *
 * El renderer es síncrono, pero las imágenes cargan async. Este registro
 * cachea cada dataURL como HTMLImageElement y avisa cuando termina de
 * cargar, para que la capa React vuelva a dibujar la textura. Así el
 * renderer sigue siendo puro: dibuja lo que ya está cargado y nada más.
 */

type Entry = { img: HTMLImageElement; ready: boolean };

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

export function onImagesReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Devuelve la imagen si ya está lista; si no, dispara la carga y null. */
export function getImage(src: string): HTMLImageElement | null {
  const existing = cache.get(src);
  if (existing) return existing.ready ? existing.img : null;

  const img = new Image();
  const entry: Entry = { img, ready: false };
  cache.set(src, entry);
  img.onload = () => {
    entry.ready = true;
    listeners.forEach((cb) => cb());
  };
  img.onerror = () => {
    // Se deja no-ready: no rompe el render, sólo no aparece.
    cache.delete(src);
  };
  img.src = src;
  return null;
}
