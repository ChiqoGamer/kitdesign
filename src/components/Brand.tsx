/**
 * Marca de Origami Design.
 *
 * El isotipo es una camiseta armada con pliegues de papel: cada faceta es
 * un triángulo con su propio tono, separadas por una línea fina del color
 * del fondo, como las aristas de una figura de origami. El escote en V es
 * el hueco que dejan los dos pliegues del hombro. Va dentro de un círculo
 * claro para que se lea igual sobre la interfaz oscura que en un avatar.
 */

/** Facetas en un lienzo de 100×100: [puntos, opacidad]. */
const FACETS: [string, number][] = [
  ["13,40 34,21 30,49", 0.82], // manga izquierda
  ["87,40 66,21 70,49", 0.62], // manga derecha
  ["34,21 50,35 31,81", 0.9], // delantero izquierdo, pliegue alto
  ["50,35 50,81 31,81", 1], // delantero izquierdo, pliegue bajo
  ["66,21 50,35 69,81", 1], // delantero derecho, pliegue alto
  ["50,35 50,81 69,81", 0.72], // delantero derecho, pliegue bajo
];

export function OrigamiMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="origami-paper" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9dbde" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#origami-paper)" />
      <g
        transform="translate(50 51) scale(0.78) translate(-50 -51)"
        stroke="#eceef0"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        {FACETS.map(([points, opacity]) => (
          <polygon key={points} points={points} fill="#0b0d10" fillOpacity={opacity} />
        ))}
      </g>
    </svg>
  );
}

export const APP_NAME = "Origami Design";

/**
 * Logo + nombre. El nombre va en mayúsculas finas y muy espaciadas, como
 * un sello. Con `compact` se oculta en pantallas angostas: en un celular la
 * barra superior necesita ese lugar para Compartir.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5" aria-label={APP_NAME}>
      <OrigamiMark />
      <span
        className={`flex-col leading-none ${compact ? "hidden sm:flex" : "flex"}`}
        aria-hidden="true"
      >
        <span className="whitespace-nowrap text-[13px] font-light tracking-[0.32em] text-ink-50">
          ORIGAMI
        </span>
        <span className="mt-1 whitespace-nowrap text-[8px] font-medium tracking-[0.42em] text-ink-400">
          DESIGN
        </span>
      </span>
    </div>
  );
}
