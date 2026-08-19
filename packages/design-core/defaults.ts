import { DEFAULT_PATTERN_PARAMS, type DesignState, type ZoneFill } from "./types";

function fill(
  pattern: ZoneFill["pattern"],
  colors: ZoneFill["colors"],
  params: Partial<typeof DEFAULT_PATTERN_PARAMS> = {},
): ZoneFill {
  return {
    pattern,
    colors,
    params: { ...DEFAULT_PATTERN_PARAMS, ...params },
  };
}

export function createDefaultDesign(): DesignState {
  return {
    schema: 1,
    meta: { name: "Titular 2027", clubName: "Tu Club", kind: "HOME" },
    palette: [
      { id: "p0", hex: "#0B4DA2", name: "Azul" },
      { id: "p1", hex: "#FFFFFF", name: "Blanco" },
      { id: "p2", hex: "#E11D2E", name: "Rojo" },
    ],
    jersey: {
      construction: { collar: "crew", sleeve: "short" },
      zones: {
        body: fill("stripesV", ["palette:0", "palette:1", "palette:2"], {
          count: 7,
          width: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    },
  };
}

/**
 * Plantillas: puntos de partida, no diseños cerrados.
 * Los colores son referencias a la paleta, así que cada plantilla se
 * muestra automáticamente con los colores del club. Eso es lo que permite
 * que el paso 2 del onboarding muestre "tu" camiseta y no una genérica.
 */
export interface Template {
  slug: string;
  name: string;
  build: () => DesignState["jersey"];
}

export const TEMPLATES: Template[] = [
  {
    slug: "lisa",
    name: "Lisa",
    build: () => ({
      construction: { collar: "crew", sleeve: "short" },
      zones: {
        body: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    }),
  },
  {
    slug: "rayas-clasicas",
    name: "Rayas clásicas",
    build: () => ({
      construction: { collar: "crew", sleeve: "short" },
      zones: {
        body: fill("stripesV", ["palette:0", "palette:1", "palette:2"], {
          count: 7,
          width: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    }),
  },
  {
    slug: "banda",
    name: "Banda cruzada",
    build: () => ({
      construction: { collar: "v", sleeve: "short" },
      zones: {
        body: fill("sash", ["palette:0", "palette:2", "palette:1"], {
          width: 0.22,
          angle: 28,
          position: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:2", "palette:1", "palette:0"]),
      },
    }),
  },
  {
    slug: "aros",
    name: "Aros",
    build: () => ({
      construction: { collar: "crew", sleeve: "short" },
      zones: {
        body: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 9,
          width: 0.5,
        }),
        sleeves: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 4,
          width: 0.5,
        }),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    }),
  },
  {
    slug: "mitades",
    name: "Mitades",
    build: () => ({
      construction: { collar: "crew", sleeve: "short" },
      zones: {
        body: fill("halves", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        sleeves: fill("halves", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    }),
  },
  {
    slug: "degrade",
    name: "Degradado",
    build: () => ({
      construction: { collar: "v", sleeve: "short" },
      zones: {
        body: fill("gradient", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        sleeves: fill("solid", ["palette:2", "palette:1", "palette:0"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
      },
    }),
  },
];
