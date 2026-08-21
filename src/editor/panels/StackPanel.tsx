"use client";

import { useRef, useState } from "react";
import {
  ANCHORS,
  GARMENT_ZONES,
  ZONE_LABELS,
  createLogoLayer,
  createNumberLayer,
  createTextLayer,
  layerGarment,
  resolveColor,
  type AnchorId,
  type Layer,
  type ZoneId,
} from "@core/index";
import { useEditor } from "../store";
import { ZoneControls } from "./ZoneControls";
import { LayerEditor } from "./LayerEditor";

type Tab = "capas" | "logos" | "numeros";

const TABS: { id: Tab; label: string }[] = [
  { id: "capas", label: "Capas" },
  { id: "logos", label: "Logos" },
  { id: "numeros", label: "Números" },
];

const EyeIcon = ({ on }: { on: boolean }) =>
  on ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.5" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.4 3.4M9.9 5.2A9.7 9.7 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-2.6 3.4M6.1 6.1A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 004-.9" /></svg>
  );

const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" /></svg>
);

/** Fila de capa: ojo · muestra de color · nombre · borrar. */
function Row({
  active,
  visible,
  swatch,
  name,
  onToggle,
  onSelect,
  onDelete,
}: {
  active: boolean;
  visible: boolean;
  swatch: string | null;
  name: string;
  onToggle: () => void;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px] transition-colors ${
        active
          ? "border-ink-500 bg-ink-700 text-ink-50"
          : "border-transparent text-ink-300 hover:bg-ink-800"
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="text-ink-400 hover:text-ink-100"
        title={visible ? "Ocultar" : "Mostrar"}
      >
        <EyeIcon on={visible} />
      </button>
      {swatch !== null ? (
        <span className="h-4 w-4 shrink-0 rounded border border-ink-500" style={{ background: swatch }} />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
      <span className={`min-w-0 flex-1 truncate ${visible ? "" : "text-ink-500"}`}>{name}</span>
      {onDelete ? (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-ink-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
          title="Borrar"
        >
          <DeleteIcon />
        </button>
      ) : (
        <span className="w-3.5" />
      )}
    </div>
  );
}

const ADD_BUTTONS = [
  { key: "base", label: "Diseño base", icon: "M4 6h16M4 12h16M4 18h16", ready: true },
  { key: "textura", label: "Importar textura", icon: "M4 5h16v11H4zM4 12l4-3 4 3 4-4 4 3", ready: true },
  { key: "patron", label: "Patrón", icon: "M5 5h3v3H5zM10 5h3v3h-3zM15 5h3v3h-3zM5 10h3v3H5zM10 10h3v3h-3zM15 10h3v3h-3z", ready: true },
  { key: "texto", label: "Texto", icon: "M5 6h14M12 6v12", ready: true },
  { key: "logo", label: "Logo", icon: "M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z", ready: true },
  { key: "cuffs", label: "Puños", icon: "M6 8h12v3l-2 2H8l-2-2z", ready: false },
  { key: "sidePanels", label: "Paneles laterales", icon: "M6 4v16M18 4v16", ready: true },
  { key: "shoulderPanels", label: "Paneles hombros", icon: "M4 8l8-4 8 4", ready: true },
] as const;

export function StackPanel() {
  const [tab, setTab] = useState<Tab>("capas");
  const [notice, setNotice] = useState<string | null>(null);

  const design = useEditor((s) => s.design);
  const dispatch = useEditor((s) => s.dispatch);
  const addLayer = useEditor((s) => s.addLayer);
  const selectedZone = useEditor((s) => s.selectedZone);
  const selectZone = useEditor((s) => s.selectZone);
  const selectedLayerId = useEditor((s) => s.selectedLayerId);
  const selectLayer = useEditor((s) => s.selectLayer);

  const fileInput = useRef<HTMLInputElement>(null);
  const pendingAnchor = useRef<AnchorId>("crest");
  const pendingName = useRef<string>("Logo");
  /** Qué hacer con el archivo que vuelva del mismo <input type="file">. */
  const pendingKind = useRef<"logo" | "texture">("logo");

  const jerseyZones = GARMENT_ZONES.jersey; // [body, sleeves, collar]
  const logoLayers = design.layers.filter((l) => l.kind === "logo" && layerGarment(l) === "jersey");
  const textNumLayers = design.layers.filter(
    (l) => (l.kind === "number" || l.kind === "text") && layerGarment(l) === "jersey",
  );

  const uploadLogo = (anchor: AnchorId, name: string) => {
    pendingKind.current = "logo";
    pendingAnchor.current = anchor;
    pendingName.current = name;
    fileInput.current?.click();
  };

  const importTexture = () => {
    pendingKind.current = "texture";
    fileInput.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (pendingKind.current === "texture") {
        dispatch({
          type: "IMPORT_TEXTURE",
          texture: { src, name: file.name, layout: "reference" },
        });
        setNotice(null);
        return;
      }
      addLayer(createLogoLayer(src, pendingAnchor.current, pendingName.current));
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = (key: string, ready: boolean, label: string) => {
    if (!ready) {
      setNotice(`“${label}” llega pronto — lo afinamos en el próximo paso.`);
      return;
    }
    setNotice(null);
    if (key === "texto") { addLayer(createTextLayer("JUGADOR")); setTab("numeros"); }
    else if (key === "logo") { uploadLogo("chest", "Sponsor"); setTab("logos"); }
    else if (key === "textura") { importTexture(); }
    else if (key === "patron") { selectZone("body"); }
    else if (key === "base") { selectZone("body"); }
    else if (key === "sidePanels") {
      dispatch({ type: "SET_ZONE_HIDDEN", zone: "sidePanels", hidden: false });
      selectZone("sidePanels");
    } else if (key === "shoulderPanels") {
      dispatch({ type: "SET_ZONE_HIDDEN", zone: "shoulderPanels", hidden: false });
      selectZone("shoulderPanels");
    }
  };

  return (
    <>
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleFile} className="hidden" />

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-ink-700 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id ? "bg-ink-700 text-ink-50" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "capas" && (
        <>
          {design.kit.texture && (
            <div className="mx-2 mt-2 rounded-md border border-accent/40 bg-accent/10 p-2">
              <div className="flex items-center gap-2">
                <img
                  src={design.kit.texture.src}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded border border-ink-700 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink-100">
                    {design.kit.texture.name}
                  </div>
                  <div className="text-[10px] text-ink-400">
                    Textura importada — reemplaza el patrón base
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: "CLEAR_TEXTURE" })}
                  className="shrink-0 rounded px-2 py-1 text-[11px] font-medium text-ink-300 hover:bg-ink-700 hover:text-ink-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          )}
          <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-500">
            {ZONE_LABELS[selectedZone]}
          </div>
          <div className="flex flex-col gap-1 p-2">
            {/* Paneles activos: overlays sobre la base, arriba en el apilado */}
            {(["shoulderPanels", "sidePanels"] as ZoneId[])
              .filter((z) => !design.kit.zones[z].hidden)
              .map((zone) => (
                <Row
                  key={zone}
                  active={selectedZone === zone}
                  visible={!design.kit.zones[zone].hidden}
                  swatch={resolveColor(design, design.kit.zones[zone].colors[0])}
                  name={ZONE_LABELS[zone]}
                  onToggle={() => dispatch({ type: "TOGGLE_ZONE", zone })}
                  onSelect={() => selectZone(zone)}
                  onDelete={() => {
                    dispatch({ type: "SET_ZONE_HIDDEN", zone, hidden: true });
                    if (selectedZone === zone) selectZone("body");
                  }}
                />
              ))}
            {/* Zonas base como capas — de arriba (cuello) hacia abajo (base) */}
            {[...jerseyZones].reverse().map((zone: ZoneId) => (
              <Row
                key={zone}
                active={selectedZone === zone}
                visible={!design.kit.zones[zone].hidden}
                swatch={resolveColor(design, design.kit.zones[zone].colors[0])}
                name={zone === "body" ? "Base (torso)" : ZONE_LABELS[zone]}
                onToggle={() => dispatch({ type: "TOGGLE_ZONE", zone })}
                onSelect={() => selectZone(zone)}
              />
            ))}
          </div>

          <div className="border-y border-ink-700 bg-ink-900/40 px-3 py-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-500">
              Añadir capa
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {ADD_BUTTONS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => handleAdd(b.key, b.ready, b.label)}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                    b.ready
                      ? "border-ink-700 text-ink-200 hover:border-ink-500 hover:bg-ink-800"
                      : "border-ink-800 text-ink-500 hover:bg-ink-800/50"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={b.icon} /></svg>
                  <span className="truncate">{b.label}</span>
                </button>
              ))}
            </div>
            {notice ? <p className="mt-2 text-[11px] text-accent-dim">{notice}</p> : null}
          </div>

          <ZoneControls zone={selectedZone} />
        </>
      )}

      {tab === "logos" && (
        <>
          <div className="flex gap-2 p-3">
            <button
              onClick={() => uploadLogo("crest", "Escudo")}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-ink-700 px-3 py-2.5 text-[13px] text-ink-200 hover:border-ink-500 hover:bg-ink-800"
            >
              Subir escudo
            </button>
            <button
              onClick={() => uploadLogo("chest", "Sponsor")}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-ink-700 px-3 py-2.5 text-[13px] text-ink-200 hover:border-ink-500 hover:bg-ink-800"
            >
              Subir sponsor
            </button>
          </div>
          <LayerList layers={logoLayers} selectedId={selectedLayerId} onSelect={selectLayer}
            emptyText="Subí el escudo de tu club y los sponsors (PNG, JPG o SVG)." />
          {selectedLayerId && logoLayers.some((l) => l.id === selectedLayerId) ? (
            <LayerEditor layerId={selectedLayerId} />
          ) : null}
        </>
      )}

      {tab === "numeros" && (
        <>
          <div className="flex gap-2 p-3">
            <button
              onClick={() => addLayer(createTextLayer("JUGADOR"))}
              className="flex flex-1 items-center justify-center rounded-md border border-ink-700 px-3 py-2.5 text-[13px] text-ink-200 hover:border-ink-500 hover:bg-ink-800"
            >
              Agregar nombre
            </button>
            <button
              onClick={() => addLayer(createNumberLayer("10"))}
              className="flex flex-1 items-center justify-center rounded-md border border-ink-700 px-3 py-2.5 text-[13px] text-ink-200 hover:border-ink-500 hover:bg-ink-800"
            >
              Agregar número
            </button>
          </div>
          <LayerList layers={textNumLayers} selectedId={selectedLayerId} onSelect={selectLayer}
            emptyText="Agregá el nombre y el número del jugador." />
          {selectedLayerId && textNumLayers.some((l) => l.id === selectedLayerId) ? (
            <LayerEditor layerId={selectedLayerId} />
          ) : null}
        </>
      )}
    </>
  );
}

function LayerList({
  layers,
  selectedId,
  onSelect,
  emptyText,
}: {
  layers: Layer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  const dispatch = useEditor((s) => s.dispatch);
  const selectLayer = useEditor((s) => s.selectLayer);
  if (layers.length === 0) {
    return <p className="px-4 pb-2 text-xs text-ink-500">{emptyText}</p>;
  }
  return (
    <div className="flex flex-col gap-1 px-2 pb-2">
      {[...layers].reverse().map((l) => (
        <Row
          key={l.id}
          active={selectedId === l.id}
          visible={l.visible}
          swatch={null}
          name={label(l)}
          onToggle={() => dispatch({ type: "TOGGLE_LAYER", id: l.id })}
          onSelect={() => onSelect(l.id)}
          onDelete={() => {
            if (selectedId === l.id) selectLayer(null);
            dispatch({ type: "REMOVE_LAYER", id: l.id });
          }}
        />
      ))}
    </div>
  );
}

function label(l: Layer): string {
  const where = ANCHORS[l.anchor].label;
  if (l.kind === "text") return `“${l.text}” · ${where}`;
  if (l.kind === "number") return `Nº ${l.value} · ${where}`;
  return `${l.name} · ${where}`;
}
