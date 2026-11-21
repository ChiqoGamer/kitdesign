/**
 * Marca de Origami Design.
 *
 * El isotipo es una hoja plegada en diagonal: dos triángulos con distinto
 * tono, como el primer pliegue de cualquier figura de origami. Se dibuja
 * con trazos rellenos y no con contorno para que siga leyéndose a 16 px.
 */
export function OrigamiMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="5" className="fill-accent" />
      <path d="M5 18 12 5l7 13z" className="fill-accent-ink" opacity="0.92" />
      <path d="M12 5v13h7z" className="fill-accent-ink" opacity="0.55" />
    </svg>
  );
}

export const APP_NAME = "Origami Design";

/**
 * Logo + nombre. Con `compact` el nombre se oculta en pantallas angostas:
 * en un celular la barra superior necesita ese lugar para Compartir.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-label={APP_NAME}>
      <OrigamiMark />
      <span
        className={`whitespace-nowrap text-sm font-semibold tracking-tight ${
          compact ? "hidden sm:inline" : ""
        }`}
      >
        {APP_NAME}
      </span>
    </div>
  );
}
