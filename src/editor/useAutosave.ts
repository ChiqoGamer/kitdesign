"use client";

import { useEffect, useRef } from "react";
import { useEditor } from "./store";

const DEBOUNCE_MS = 900;

/**
 * Autoguardado: restaura el diseño al abrir y guarda con debounce cada vez
 * que cambia. El botón "Guardar" existe igual, pero es un punto explícito,
 * no la única forma de no perder el trabajo — nadie debería perder un
 * diseño por olvidarse de apretar un botón.
 */
export function useAutosave(): void {
  const revision = useEditor((s) => s.revision);
  const saveState = useEditor((s) => s.saveState);
  const save = useEditor((s) => s.save);
  const restore = useEditor((s) => s.restore);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    restore();
  }, [restore]);

  useEffect(() => {
    if (saveState !== "pendiente") return;
    const t = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [revision, saveState, save]);

  // Último intento al cerrar la pestaña.
  useEffect(() => {
    const onLeave = () => {
      if (useEditor.getState().saveState === "pendiente") save();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [save]);
}
