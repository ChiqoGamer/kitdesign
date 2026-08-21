"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignState } from "@core/index";
import { renderPresentation } from "@render/presentation";
import { onImagesReady } from "@render/images";
import { captureViewerPng, hasViewerCanvas } from "@/src/three/capture";

type Kind = "presentacion" | "visor";

const SIZES = {
  presentacion: { width: 1200, height: 1500 },
};

/** Nombre de archivo legible y seguro a partir del club y el diseño. */
function fileName(design: DesignState, kind: Kind): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "diseno";
  const base = `${slug(design.meta.clubName)}-${slug(design.meta.name)}`;
  return `${base}-${kind === "presentacion" ? "presentacion" : "3d"}.png`;
}

export function ExportDialog({
  design,
  onClose,
}: {
  design: DesignState;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>("presentacion");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLImageElement>(null);

  // La lámina se rehace cuando cambia la opción (y cuando terminan de
  // cargar las imágenes de las capas, para no exportar sin el escudo).
  useEffect(() => {
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      setError("");
      if (kind === "visor") {
        if (!hasViewerCanvas()) {
          setDataUrl(null);
          setError("Abrí la vista 3D para poder capturarla.");
          return;
        }
        const png = captureViewerPng();
        if (!png) {
          setDataUrl(null);
          setError("No se pudo capturar el visor.");
          return;
        }
        setDataUrl(png);
        return;
      }

      const { width, height } = SIZES.presentacion;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const fontFamily =
        getComputedStyle(document.body).fontFamily ||
        "system-ui, sans-serif";
      renderPresentation(ctx, design, { width, height, fontFamily });
      setDataUrl(canvas.toDataURL("image/png"));
    };

    build();
    const off = onImagesReady(build);
    return () => {
      cancelled = true;
      off();
    };
  }, [design, kind]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName(design, kind);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-ink-700 bg-ink-850 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">Exportar imagen</h2>
        <p className="mt-1 text-xs text-ink-400">
          La presentación sirve para mandar por WhatsApp o publicar; la
          captura 3D toma la vista tal como está en pantalla.
        </p>

        <div className="mt-4 flex gap-1 rounded-lg bg-ink-800 p-1">
          {(
            [
              ["presentacion", "Presentación"],
              ["visor", "Captura 3D"],
            ] as [Kind, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                kind === k ? "bg-ink-600 text-ink-50" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-ink-700 bg-ink-900 p-3">
          {error ? (
            <p className="py-8 text-center text-xs text-ink-500">{error}</p>
          ) : dataUrl ? (
            <img
              ref={previewRef}
              src={dataUrl}
              alt="Previsualización de la exportación"
              className="mx-auto max-h-[46vh] w-auto rounded"
            />
          ) : (
            <p className="py-8 text-center text-xs text-ink-500">Generando…</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={download}
            disabled={!dataUrl}
            className="flex-1 rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-dim disabled:opacity-50"
          >
            Descargar PNG
          </button>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2.5 text-xs text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
