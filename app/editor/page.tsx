"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  GARMENT_IDS,
  GARMENT_LABELS,
  ZONE_LABELS,
  type GarmentId,
  type ZoneId,
} from "@core/index";
import { useEditor } from "@/src/editor/store";
import { useAutosave } from "@/src/editor/useAutosave";
import { ShareDialog } from "@/src/editor/ShareDialog";
import { ExportDialog } from "@/src/editor/ExportDialog";
import { StackPanel } from "@/src/editor/panels/StackPanel";
import { PalettePanel } from "@/src/editor/panels/PalettePanel";
import { TemplatePanel } from "@/src/editor/panels/TemplatePanel";
import { ConstructionPanel } from "@/src/editor/panels/ConstructionPanel";
import { TextureView } from "@/src/editor/TextureView";
import { FlatView } from "@/src/editor/FlatView";
import { IconButton } from "@/src/components/ui";
import { VIEW_LABELS, type ViewName } from "@/src/three/Viewer";

// El visor sólo existe en el cliente: WebGL no tiene nada que hacer en SSR.
const Viewer = dynamic(
  () => import("@/src/three/Viewer").then((m) => m.Viewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-ink-500">
        Cargando visor 3D…
      </div>
    ),
  },
);

const SECTIONS = [
  { id: "zonas", label: "Editar camiseta", icon: "M4 7h16M4 12h16M4 17h10" },
  { id: "plantillas", label: "Plantillas", icon: "M4 5h7v7H4zM13 5h7v4h-7zM13 13h7v6h-7zM4 16h7v3H4z" },
  { id: "colores", label: "Colores", icon: "M12 3a9 9 0 100 18h1a2 2 0 002-2 2 2 0 012-2h1a3 3 0 003-3 9 9 0 00-9-11z" },
  { id: "confeccion", label: "Confección", icon: "M6 4l6 5 6-5v16H6z" },
];

const FOCUS_TABS: { id: GarmentId | "all"; label: string }[] = [
  { id: "all", label: "Equipación" },
  ...GARMENT_IDS.map((g) => ({ id: g, label: GARMENT_LABELS[g] })),
];

type Mode = "3d" | "flat" | "texture";

export default function EditorPage() {
  const design = useEditor((s) => s.design);
  const revision = useEditor((s) => s.revision);
  const section = useEditor((s) => s.section);
  const setSection = useEditor((s) => s.setSection);
  const selectZone = useEditor((s) => s.selectZone);
  const focus = useEditor((s) => s.focus);
  const setFocus = useEditor((s) => s.setFocus);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const [mode, setMode] = useState<Mode>("3d");
  const [view, setView] = useState<ViewName>("front");
  const [viewNonce, setViewNonce] = useState(0);
  const [hovered, setHovered] = useState<ZoneId | null>(null);
  const [refMesh, setRefMesh] = useState(true);

  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useAutosave();
  const saveState = useEditor((s) => s.saveState);
  const save = useEditor((s) => s.save);

  const goToView = (v: ViewName) => {
    setView(v);
    setViewNonce((n) => n + 1);
  };

  const handleHover = useCallback((zone: ZoneId | null) => {
    setHovered((prev) => (prev === zone ? prev : zone));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="grid h-full grid-rows-[52px_1fr] bg-ink-900">
      {/* ── Barra superior ─────────────────────────────────────────── */}
      <header className="flex items-center gap-4 border-b border-ink-700 bg-ink-850 px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded bg-accent text-[13px] font-black text-accent-ink">
            K
          </div>
          <span className="text-sm font-semibold tracking-tight">
            KitDesign
          </span>
        </div>

        <div className="h-5 w-px bg-ink-700" />

        <div className="min-w-0 text-sm text-ink-300">
          <span className="text-ink-500">{design.meta.clubName}</span>
          <span className="mx-1.5 text-ink-600">/</span>
          <span className="text-ink-100">{design.meta.name}</span>
        </div>

        {/* Modo 3D / Textura, como los tabs de la referencia */}
        <div className="ml-6 flex gap-1 rounded-lg bg-ink-800 p-1">
          {(
            [
              { id: "3d", label: "3D" },
              { id: "flat", label: "2D" },
              { id: "texture", label: "Textura" },
            ] as { id: Mode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                mode === m.id
                  ? "bg-ink-600 text-ink-50"
                  : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IconButton onClick={undo} disabled={!canUndo} title="Deshacer (⌘Z)">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h11a5 5 0 010 10h-4" />
            </svg>
          </IconButton>
          <IconButton onClick={redo} disabled={!canRedo} title="Rehacer (⇧⌘Z)">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 14l5-5-5-5" />
              <path d="M20 9H9a5 5 0 000 10h4" />
            </svg>
          </IconButton>
          <div className="mx-2 h-5 w-px bg-ink-700" />
          <span className="mr-1 text-[11px] text-ink-500">
            {saveState === "guardado"
              ? "Guardado"
              : saveState === "guardando"
                ? "Guardando…"
                : saveState === "pendiente"
                  ? "Sin guardar"
                  : saveState === "sin-espacio"
                    ? "No entra en este navegador"
                    : ""}
          </span>
          <button
            onClick={save}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50"
          >
            Guardar
          </button>
          <button
            onClick={() => setExporting(true)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50"
          >
            Exportar
          </button>
          <button
            onClick={() => setSharing(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-dim"
          >
            Compartir
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[196px_1fr_312px]">
        {/* ── Navegación izquierda ─────────────────────────────────── */}
        <nav className="flex flex-col border-r border-ink-700 bg-ink-850 py-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`mx-2 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                section === s.id
                  ? "bg-ink-700 text-ink-50"
                  : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={s.icon} />
              </svg>
              {s.label}
            </button>
          ))}

          <div className="mt-auto px-2 pb-1 pt-4">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500">
              Prenda
            </div>
            {FOCUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFocus(t.id)}
                className={`mb-0.5 block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  focus === t.id
                    ? "bg-ink-700 text-ink-50"
                    : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Visor ────────────────────────────────────────────────── */}
        <main className="relative min-w-0 bg-ink-900">
          {mode === "3d" ? (
            <>
              <Viewer
                refMesh={refMesh}
                design={design}
                revision={revision}
                view={view}
                viewNonce={viewNonce}
                focus={focus}
                onPickZone={selectZone}
                onHoverZone={handleHover}
              />

              {hovered ? (
                <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-full bg-ink-800/90 px-3 py-1 text-xs text-ink-100 backdrop-blur">
                  {ZONE_LABELS[hovered]} — clic para editar
                </div>
              ) : null}

              <div className="pointer-events-none absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg bg-ink-800/90 p-1 backdrop-blur">
                {(Object.keys(VIEW_LABELS) as ViewName[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => goToView(v)}
                    className={`pointer-events-auto rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      view === v
                        ? "bg-ink-600 text-ink-50"
                        : "text-ink-400 hover:text-ink-100"
                    }`}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                ))}
              </div>

              <div className="absolute bottom-5 right-5 flex items-center gap-3">
                <button
                  onClick={() => setRefMesh((v) => !v)}
                  className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                    refMesh
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-ink-700 text-ink-400 hover:text-ink-100"
                  }`}
                  title="Alternar entre la malla de referencia y la generada por código"
                >
                  {refMesh ? "Malla: referencia" : "Malla: procedural"}
                </button>
                <span className="pointer-events-none text-[11px] text-ink-600">
                  Arrastrá para rotar · rueda para zoom
                </span>
              </div>
            </>
          ) : mode === "flat" ? (
            <FlatView design={design} revision={revision} />
          ) : (
            <TextureView design={design} revision={revision} />
          )}
        </main>

        {/* ── Panel de propiedades ─────────────────────────────────── */}
        <aside className="min-h-0 overflow-y-auto border-l border-ink-700 bg-ink-850">
          {section === "zonas" ? <StackPanel /> : null}
          {section === "plantillas" ? <TemplatePanel /> : null}
          {section === "colores" ? <PalettePanel /> : null}
          {section === "confeccion" ? <ConstructionPanel /> : null}
        </aside>
      </div>
      {sharing ? (
        <ShareDialog design={design} onClose={() => setSharing(false)} />
      ) : null}
      {exporting ? (
        <ExportDialog design={design} onClose={() => setExporting(false)} />
      ) : null}
    </div>
  );
}
