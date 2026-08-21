"use client";

import { useState } from "react";
import { serializeDesign, type DesignState } from "@core/index";

type Status = "idle" | "creando" | "listo" | "error";

/**
 * Crea el link público del diseño. El link se genera contra el servidor
 * (no va todo en la URL) porque los escudos y sponsors viajan como dataURL
 * y no caben en una dirección compartible.
 */
export function ShareDialog({
  design,
  onClose,
}: {
  design: DesignState;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setStatus("creando");
    setError("");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: serializeDesign(design),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudo crear el link.");
      setUrl(`${window.location.origin}/d/${data.slug}`);
      setStatus("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el link.");
      setStatus("error");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-850 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-50">Compartir diseño</h2>
        <p className="mt-1 text-xs text-ink-400">
          Generá un link para mandarle la equipación al grupo del club o al
          fabricante. Se ve en 3D y en plano, sin poder editarse.
        </p>

        {status !== "listo" ? (
          <>
            <button
              onClick={create}
              disabled={status === "creando"}
              className="mt-4 w-full rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-dim disabled:opacity-60"
            >
              {status === "creando" ? "Creando link…" : "Crear link para compartir"}
            </button>
            {error ? (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            ) : null}
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 font-mono text-xs text-ink-100 outline-none"
              />
              <button
                onClick={copy}
                className="shrink-0 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-dim"
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-accent hover:underline"
            >
              Abrir el link en una pestaña nueva →
            </a>
            <p className="mt-3 text-[11px] text-ink-500">
              El link guarda una copia del diseño tal como está ahora. Si
              después lo cambiás, generá un link nuevo.
            </p>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md px-3 py-2 text-xs text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
