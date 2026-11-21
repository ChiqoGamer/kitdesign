"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { GARMENT_IDS, GARMENT_LABELS, type GarmentId } from "@core/index";
import { activeGarment, useEditor } from "@/src/editor/store";
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
import { Brand } from "@/src/components/Brand";
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

/**
 * Siluetas de prenda. Van rellenas y no con trazo: a 16 px un contorno de
 * camiseta se empasta y deja de leerse, la silueta se reconoce por la forma.
 */
const GARMENT_ICONS: Record<GarmentId | "all", string> = {
  all:
    "M9.2 2.2 6.4 3.6 4.6 7.1 6.6 8.2 7.4 6.8v5.6h9.2V6.8l.8 1.4 2-1.1-1.8-3.5-2.8-1.4c-.6 1.2-1.7 1.7-2.8 1.7s-2.2-.5-2.8-1.7z" +
    "M7.5 13.9h9l.4 7.9h-3.8L12 17.9l-1.1 3.9H7.1z",
  jersey:
    "M9 3 5.5 4.8 3.2 9.2 5.8 10.6 6.8 8.8V21h10.4V8.8l1 1.8 2.6-1.4-2.3-4.4L15 3c-.8 1.6-2.1 2.2-3 2.2S9.8 4.6 9 3z",
  shorts: "M5 4h14l.7 15.8h-6L12 12.6l-1.7 7.2h-6z",
  socks:
    "M6.2 3h3.4v9.4c0 2.2-1.2 3.6-3.1 3.6H4v-3.4h1.8c.3 0 .4-.2.4-.7z" +
    "M12.8 3h3.4v9.4c0 2.2-1.2 3.6-3.1 3.6h-2.5v-3.4h1.8c.3 0 .4-.2.4-.7z",
};

/**
 * Herramientas que no son una prenda. Van con trazo (son íconos de UI, no
 * siluetas) y separadas de las prendas para que el menú se lea en dos
 * bloques: QUÉ estoy editando y CON QUÉ.
 */
const TOOLS = [
  { id: "plantillas", label: "Plantillas", icon: "M4 5h7v7H4zM13 5h7v4h-7zM13 13h7v6h-7zM4 16h7v3H4z" },
  { id: "colores", label: "Colores del club", icon: "M12 3a9 9 0 100 18h1a2 2 0 002-2 2 2 0 012-2h1a3 3 0 003-3 9 9 0 00-9-11z" },
  { id: "confeccion", label: "Cuello y mangas", icon: "M6 4l6 5 6-5v16H6z" },
] as const;

type Mode = "3d" | "flat" | "texture";

const MODES: { id: Mode; label: string }[] = [
  { id: "3d", label: "3D" },
  { id: "flat", label: "2D" },
  { id: "texture", label: "Textura" },
];

const SAVE_LABELS: Record<string, string> = {
  guardado: "Guardado",
  guardando: "Guardando…",
  pendiente: "Sin guardar",
  "sin-espacio": "No entra en este navegador",
};

function NavButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-md px-3 py-1.5 text-[11px] transition-colors lg:mx-2 lg:mb-0.5 lg:flex-row lg:gap-2.5 lg:px-3 lg:py-2 lg:text-left lg:text-[13px] ${
        active
          ? "bg-ink-700 text-ink-50"
          : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
      }`}
    >
      {children}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function EditorPage() {
  const design = useEditor((s) => s.design);
  const revision = useEditor((s) => s.revision);
  const section = useEditor((s) => s.section);
  const setSection = useEditor((s) => s.setSection);
  const selectZone = useEditor((s) => s.selectZone);
  const focus = useEditor((s) => s.focus);
  const setFocus = useEditor((s) => s.setFocus);
  const garment = useEditor(activeGarment);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const [mode, setMode] = useState<Mode>("3d");
  const [view, setView] = useState<ViewName>("front");
  const [viewNonce, setViewNonce] = useState(0);
  const [freeOrbit, setFreeOrbit] = useState(false);

  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useAutosave();
  const saveState = useEditor((s) => s.saveState);
  const save = useEditor((s) => s.save);

  const goToView = (v: ViewName) => {
    setView(v);
    setViewNonce((n) => n + 1);
  };

  /** Elegir una prenda la encuadra y abre su panel: un solo gesto. */
  const editGarment = (g: GarmentId) => {
    setFocus(g);
    setSection("zonas");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        // El guardado es automático; Ctrl+S queda para quien lo tiene en
        // los dedos y así no abre el "Guardar página" del navegador.
        e.preventDefault();
        save();
        return;
      }
      if (key !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, save]);

  const wholeKit = focus === "all";

  return (
    <div className="flex h-full flex-col bg-ink-900">
      {/* ── Barra superior ─────────────────────────────────────────── */}
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-850 px-3 lg:gap-4 lg:px-4">
        <Brand compact />

        <div className="hidden h-5 w-px bg-ink-700 md:block" />

        <div className="hidden min-w-0 truncate text-sm text-ink-300 md:block">
          <span className="text-ink-500">{design.meta.clubName}</span>
          <span className="mx-1.5 text-ink-600">/</span>
          <span className="text-ink-100">{design.meta.name}</span>
        </div>

        <div className="flex gap-1 rounded-lg bg-ink-800 p-1 lg:ml-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
          <div className="hidden items-center gap-1 sm:flex">
            <IconButton onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h11a5 5 0 010 10h-4" />
              </svg>
            </IconButton>
            <IconButton onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14l5-5-5-5" />
                <path d="M20 9H9a5 5 0 000 10h4" />
              </svg>
            </IconButton>
            <div className="mx-2 h-5 w-px bg-ink-700" />
            {/* Estado, no botón: el diseño se guarda solo. */}
            <span
              className={`mr-2 hidden text-[11px] md:inline ${
                saveState === "sin-espacio" ? "text-red-400" : "text-ink-500"
              }`}
              title="Los cambios se guardan solos en este navegador"
              aria-live="polite"
            >
              {SAVE_LABELS[saveState] ?? ""}
            </span>
          </div>
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

      {/*
        Escritorio: menú | visor | panel.
        Celular: visor arriba, panel abajo y el menú como barra inferior, al
        alcance del pulgar.
      */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[208px_1fr_320px]">
        {/* ── Menú: prendas y herramientas ──────────────────────────── */}
        <nav
          aria-label="Secciones del editor"
          className="no-scrollbar order-last flex shrink-0 gap-1 overflow-x-auto border-t border-ink-700 bg-ink-850 px-2 py-1.5 lg:order-none lg:flex-col lg:gap-0 lg:overflow-visible lg:border-t-0 lg:border-r lg:px-0 lg:py-3"
        >
          <div className="hidden px-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500 lg:block">
            Prendas
          </div>
          {GARMENT_IDS.map((g) => (
            <NavButton
              key={g}
              active={section === "zonas" && garment === g}
              label={GARMENT_LABELS[g]}
              onClick={() => editGarment(g)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" fill="currentColor" aria-hidden="true">
                <path d={GARMENT_ICONS[g]} />
              </svg>
            </NavButton>
          ))}

          <div className="mx-1 w-px shrink-0 bg-ink-700 lg:mx-5 lg:my-3 lg:h-px lg:w-auto" />
          <div className="hidden px-5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500 lg:block">
            Herramientas
          </div>
          {TOOLS.map((t) => (
            <NavButton
              key={t.id}
              active={section === t.id}
              label={t.label}
              onClick={() => setSection(t.id)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
            </NavButton>
          ))}
        </nav>

        {/* ── Visor ────────────────────────────────────────────────── */}
        <main className="relative h-[46vh] shrink-0 bg-ink-900 lg:h-auto lg:min-w-0">
          {mode === "3d" ? (
            <>
              <Viewer
                freeOrbit={freeOrbit}
                design={design}
                revision={revision}
                view={view}
                viewNonce={viewNonce}
                focus={focus}
                onPickZone={selectZone}
              />

              {/*
                Un solo control de encuadre. Antes había cuatro botones de
                prenda acá además del menú, y no se hablaban entre sí: elegías
                el short arriba y el panel seguía en la camiseta.
              */}
              <div className="absolute left-3 top-3 flex gap-1 rounded-lg bg-ink-800/90 p-1 backdrop-blur lg:left-5 lg:top-5">
                <button
                  onClick={() => setFocus(wholeKit ? garment : "all")}
                  aria-pressed={wholeKit}
                  title={wholeKit ? `Volver a ${GARMENT_LABELS[garment].toLowerCase()}` : "Ver la equipación completa"}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    wholeKit
                      ? "bg-ink-700 text-accent"
                      : "text-ink-400 hover:bg-ink-700/60 hover:text-ink-100"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d={GARMENT_ICONS.all} />
                  </svg>
                  <span className="pr-1">Kit completo</span>
                </button>
              </div>

              <div className="absolute right-3 top-3 flex gap-1 rounded-lg bg-ink-800/90 p-1 backdrop-blur lg:right-5 lg:top-5">
                <button
                  onClick={() => setFreeOrbit((v) => !v)}
                  aria-pressed={freeOrbit}
                  title={
                    freeOrbit
                      ? "Movimiento libre: inclinás la cámara, Shift+arrastrar desplaza y la rueda hace zoom donde está el cursor. Clic para volver al giro horizontal."
                      : "Giro horizontal: la prenda queda centrada. Clic para poder inclinar la cámara y desplazarte."
                  }
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    freeOrbit
                      ? "bg-ink-700 text-accent"
                      : "text-ink-400 hover:bg-ink-700/60 hover:text-ink-100"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    {freeOrbit ? (
                      <>
                        <circle cx="12" cy="12" r="8" />
                        <path d="M12 4v16M4 12h16" />
                      </>
                    ) : (
                      <>
                        <ellipse cx="12" cy="12" rx="9" ry="3.5" />
                        <path d="M5 15l-2 2M19 15l2 2" />
                      </>
                    )}
                  </svg>
                  <span className="hidden pr-1 sm:inline">
                    {freeOrbit ? "Movimiento libre" : "Giro horizontal"}
                  </span>
                </button>
              </div>

              <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-lg bg-ink-800/90 p-1 backdrop-blur lg:bottom-5">
                {(Object.keys(VIEW_LABELS) as ViewName[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => goToView(v)}
                    aria-pressed={view === v}
                    className={`pointer-events-auto rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors lg:px-3 ${
                      view === v
                        ? "bg-ink-600 text-ink-50"
                        : "text-ink-400 hover:text-ink-100"
                    }`}
                  >
                    {VIEW_LABELS[v]}
                  </button>
                ))}
              </div>
            </>
          ) : mode === "flat" ? (
            <FlatView design={design} revision={revision} />
          ) : (
            <TextureView design={design} revision={revision} />
          )}
        </main>

        {/* ── Panel de propiedades ─────────────────────────────────── */}
        <aside className="min-h-0 flex-1 overflow-y-auto border-t border-ink-700 bg-ink-850 lg:border-t-0 lg:border-l">
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
