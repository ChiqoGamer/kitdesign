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

/** Paneles de hombro y laterales: existen siempre, ocultos hasta agregarse. */
function PANELS(): { shoulderPanels: ZoneFill; sidePanels: ZoneFill } {
  return {
    shoulderPanels: {
      ...fill("solid", ["palette:2", "palette:1", "palette:0"]),
      hidden: true,
    },
    sidePanels: {
      ...fill("solid", ["palette:2", "palette:1", "palette:0"]),
      hidden: true,
    },
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
    kit: {
      construction: { collar: "crew", sleeve: "short", collarWidth: 0.028 },
      zones: {
        ...PANELS(),
        body: fill("stripesV", ["palette:0", "palette:1", "palette:2"], {
          count: 7,
          width: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        socks: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 3,
          width: 0.28,
          offset: 0.72,
        }),
      },
    },
    layers: [],
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
  build: () => DesignState["kit"];
}

export const TEMPLATES: Template[] = [
  {
    slug: "lisa",
    name: "Lisa",
    build: () => ({
      construction: { collar: "crew", sleeve: "short", collarWidth: 0.028 },
      zones: {
        ...PANELS(),
        body: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        socks: fill("solid", ["palette:0", "palette:1", "palette:2"]),
      },
    }),
  },
  {
    slug: "rayas-clasicas",
    name: "Rayas clásicas",
    build: () => ({
      construction: { collar: "crew", sleeve: "short", collarWidth: 0.028 },
      zones: {
        ...PANELS(),
        body: fill("stripesV", ["palette:0", "palette:1", "palette:2"], {
          count: 7,
          width: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        socks: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 3,
          width: 0.3,
          offset: 0.7,
        }),
      },
    }),
  },
  {
    slug: "banda",
    name: "Banda cruzada",
    build: () => ({
      construction: { collar: "v", sleeve: "short" },
      zones: {
        ...PANELS(),
        body: fill("sash", ["palette:0", "palette:2", "palette:1"], {
          width: 0.22,
          angle: 28,
          position: 0.5,
        }),
        sleeves: fill("solid", ["palette:0", "palette:1", "palette:2"]),
        collar: fill("solid", ["palette:2", "palette:1", "palette:0"]),
        shorts: fill("solid", ["palette:0", "palette:2", "palette:1"]),
        socks: fill("solid", ["palette:0", "palette:2", "palette:1"]),
      },
    }),
  },
  {
    slug: "aros",
    name: "Aros",
    build: () => ({
      construction: { collar: "crew", sleeve: "short", collarWidth: 0.028 },
      zones: {
        ...PANELS(),
        body: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 9,
          width: 0.5,
        }),
        sleeves: fill("stripesH", ["palette:0", "palette:1", "palette:2"], {
          count: 4,
          width: 0.5,
        }),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        socks: fill("stripesH", ["palette:1", "palette:0", "palette:2"], {
          count: 4,
          width: 0.5,
        }),
      },
    }),
  },
  {
    slug: "mitades",
    name: "Mitades",
    build: () => ({
      construction: { collar: "crew", sleeve: "short", collarWidth: 0.028 },
      zones: {
        ...PANELS(),
        body: fill("halves", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        sleeves: fill("halves", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("halves", ["palette:2", "palette:0", "palette:1"], {
          position: 0.5,
        }),
        socks: fill("solid", ["palette:0", "palette:2", "palette:1"]),
      },
    }),
  },
  {
    slug: "degrade",
    name: "Degradado",
    build: () => ({
      construction: { collar: "v", sleeve: "short" },
      zones: {
        ...PANELS(),
        body: fill("gradient", ["palette:0", "palette:2", "palette:1"], {
          position: 0.5,
        }),
        sleeves: fill("solid", ["palette:2", "palette:1", "palette:0"]),
        collar: fill("solid", ["palette:1", "palette:0", "palette:2"]),
        shorts: fill("gradient", ["palette:0", "palette:2", "palette:1"], {
          position: 0.4,
        }),
        socks: fill("solid", ["palette:2", "palette:1", "palette:0"]),
      },
    }),
  },
];
