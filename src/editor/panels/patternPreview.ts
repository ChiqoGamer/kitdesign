import type { PatternId } from "@core/index";

/**
 * Vista previa de patrón en CSS puro. Se usa en la grilla de selección:
 * es instantánea y no consume canvas ni GPU, a diferencia de renderizar
 * seis miniaturas reales cada vez que se abre el panel.
 */
export function patternPreviewStyle(
  pattern: PatternId,
  colors: string[],
): React.CSSProperties {
  const [a, b] = colors;
  switch (pattern) {
    case "solid":
      return { background: a };
    case "stripesV":
      return {
        background: `repeating-linear-gradient(90deg, ${a} 0 9px, ${b} 9px 18px)`,
      };
    case "stripesH":
      return {
        background: `repeating-linear-gradient(0deg, ${a} 0 9px, ${b} 9px 18px)`,
      };
    case "halves":
      return { background: `linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)` };
    case "sash":
      return {
        background: `linear-gradient(200deg, ${a} 0 38%, ${b} 38% 60%, ${a} 60% 100%)`,
      };
    case "gradient":
      return { background: `linear-gradient(0deg, ${a}, ${b})` };
  }
}
