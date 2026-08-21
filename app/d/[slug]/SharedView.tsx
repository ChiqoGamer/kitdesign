"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { DesignState } from "@core/index";
import { FlatView } from "@/src/editor/FlatView";
import { VIEW_LABELS, type ViewName } from "@/src/three/Viewer";

const Viewer = dynamic(() => import("@/src/three/Viewer").then((m) => m.Viewer), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-ink-500">
      Cargando visor 3D…
    </div>
  ),
});

/** Presentación pública de un diseño: sólo mirar, rotar y ver el plano. */
export function SharedView({ design }: { design: DesignState }) {
  const [mode, setMode] = useState<"3d" | "flat">("3d");
  const [view, setView] = useState<ViewName>("front");
  const [viewNonce, setViewNonce] = useState(0);

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto]">
      <header className="flex flex-wrap items-center gap-4 border-b border-ink-700 bg-ink-850 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded bg-accent text-[13px] font-black text-accent-ink">
            K
          </div>
          <span className="text-sm font-semibold tracking-tight">KitDesign</span>
        </div>
        <div className="h-5 w-px bg-ink-700" />
        <div className="min-w-0 text-sm">
          <span className="text-ink-400">{design.meta.clubName}</span>
          <span className="mx-1.5 text-ink-600">/</span>
          <span className="text-ink-50">{design.meta.name}</span>
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-lg bg-ink-800 p-1">
          {(["3d", "flat"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m ? "bg-ink-600 text-ink-50" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {m === "3d" ? "3D" : "2D"}
            </button>
          ))}
        </div>
      </header>

      <main className="relative min-h-0 bg-ink-900">
        {mode === "3d" ? (
          <>
            <Viewer
              refMesh
              design={design}
              revision={0}
              view={view}
              viewNonce={viewNonce}
              focus="all"
              onPickZone={() => {}}
              onHoverZone={() => {}}
            />
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg bg-ink-800/90 p-1 backdrop-blur">
              {(Object.keys(VIEW_LABELS) as ViewName[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    setViewNonce((n) => n + 1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    view === v ? "bg-ink-600 text-ink-50" : "text-ink-400 hover:text-ink-100"
                  }`}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <FlatView design={design} revision={0} />
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-ink-700 bg-ink-850 px-5 py-3 text-[11px] text-ink-500">
        <span>Diseño compartido · sólo lectura</span>
        <a href="/editor" className="text-accent hover:underline">
          Crear mi equipación
        </a>
      </footer>
    </div>
  );
}
