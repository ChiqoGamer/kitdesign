# KitDesign

Plataforma para que clubes de fútbol amateur diseñen su equipación, la vean
en 3D y la envíen a fabricar.

```bash
npm install
npm run dev      # http://localhost:3000/editor
```

---

## La idea que sostiene la arquitectura

El producto no es un editor 3D: es un **traductor** de "quiero algo azul con
rayas" a un paquete de datos que un taller de sublimación pueda producir sin
volver a preguntar nada. Por eso la pregunta que define el diseño técnico no
es cómo rotar una camiseta, sino:

> ¿Cuál es la única fuente de verdad del diseño, y cómo se renderiza a la vez
> como textura de tiempo real, como archivo de impresión y como ficha técnica?

La respuesta es un JSON semántico + un renderer determinista:

```
DesignState  (JSON versionado)
     │
 compileDesign()
     │
     ├─► CanvasRenderer ──► CanvasTexture ──► visor 3D
     ├─► SvgRenderer    ──► vector 300 DPI ─► fabricación   (V2)
     └─► SpecCompiler   ──► ficha técnica  ─► cotización    (V2)
```

El 3D **no** es la fuente de verdad: es un visor. Exportar para fabricación
no será una feature nueva, sino el mismo estado por otro renderer.

## Las dos decisiones no obvias

**1. El layout UV del modelo 3D _es_ el layout de corte de la prenda.**

La sublimación imprime sobre piezas de patrón planas que después se cosen;
un UV unwrap es el mismo problema geométrico. Al hacerlos coincidir:

- las costuras del 3D caen donde caen las reales, así que un patrón que
  cruza de delantero a manga se puede alinear de verdad;
- el archivo de producción sale gratis (mismo canvas a 300 DPI);
- la vista "plano" del editor es literalmente el canvas;
- un solo mesh y un solo material ⇒ corre bien hasta en tablet.

Ver `packages/garment-geometry/atlas.ts`.

**2. Toda mutación es una acción; la IA usa exactamente el mismo camino.**

La UI despacha acciones, y el agente de IA devolverá arrays de *esas mismas*
acciones, validadas contra el mismo schema. Consecuencias: la IA no puede
producir un estado inválido, no puede hacer nada que un usuario no pueda
hacer, y todo lo que hace es reversible con Cmd+Z sin código extra.

Ver `packages/design-core/actions.ts`.

## Estructura

| Ruta | Rol |
|---|---|
| `packages/design-core` | DesignState, acciones, reducer, historial. **TypeScript puro** — no importa React, Three ni Next. |
| `packages/garment-geometry` | Atlas de patrón + geometría paramétrica de la prenda. |
| `packages/design-render` | DesignState → píxeles. Determinista y sin estado. |
| `src/editor` | Store de Zustand y paneles. |
| `src/three` | Visor R3F, materiales, textura viva. |
| `app` | Rutas de Next. |

La regla que mantiene esto sano: **`design-core` no importa React ni Three.**
Si hiciera falta, la abstracción está mal.

## Sin modelador 3D

La prenda se genera por código (`packages/garment-geometry/jersey.ts`). Para
este producto no es un compromiso sino la mejor opción: parametrizando la
superficie se controlan las UVs por construcción, así que el atlas-como-patrón
sale exacto en vez de depender de un unwrap manual.

- **Torso**: loft de secciones superelípticas, partido en dos piezas UV con
  la costura en el lateral. La UV se calcula por longitud de arco, así que el
  molde se angosta arriba igual que uno real y las rayas convergen sobre el
  hombro como en una camiseta sublimada.
- **Escote**: la altura del borde superior varía con el ángulo. Un cuello en V
  es esa curva siendo lineal en |x|; uno redondo, la misma con menos caída.
- **Mangas**: la raíz es una elipse tipo sisa ubicada *dentro* del torso.
  Solapar en vez de recortar la sisa es invisible desde afuera y evita
  operaciones booleanas sobre la malla.

## Estado actual

Hecho: núcleo de estado + historial con fusión de acciones, **equipación
completa** (camiseta con cuello redondo/V y manga corta/larga, short y
medias paramétricos, cada prenda con su propio atlas y textura), 6 patrones
paramétricos por zona (5 zonas), paleta de club, plantillas del kit entero
renderizadas con los colores del club, selección de zona clickeando el
modelo 3D, foco de cámara por prenda, vista **Textura** (los moldes de
corte en plano, con contorno y etiqueta), undo/redo.

**Sistema de capas** (hecho): sobre el patrón base de cada prenda se apilan
capas — escudo, sponsors (subida de PNG/JPG/SVG), nombre y número. Cada
capa se ancla a un punto conocido (pecho, espalda, manga, short) y guarda
offset/escala/rotación relativos. Lista de capas con ojo/reordenar/borrar,
editor de la capa seleccionada (texto, tipografía, colores, contorno,
ubicación, ajuste fino). Las capas se componen en el mismo atlas que la
textura 3D, así que aparecen igual en 3D, en la vista Textura y (a futuro)
en el archivo de fabricación.

**Guardar y compartir** (hecho): autoguardado en el navegador con
restauración al abrir, y link público `/d/[slug]` con presentación en 3D y
2D de sólo lectura. El almacén de compartidos escribe archivos en disco
(`.data/`) a propósito: el dato ya es el JSON del DesignState, así que
pasarlo a Postgres es cambiar dos funciones.

**Exportar PNG** (hecho): lámina de presentación (club, frente y espalda,
paleta con códigos, confección) generada con el renderer plano — sincrónica
y determinista, sin depender del estado de la GPU — y captura del visor 3D.

Pendiente inmediato: login y proyectos (hoy el guardado es por navegador,
no por cuenta), ficha técnica para el fabricante, y el agente de IA.

### Deuda conocida

- **`sleeveless`** existe en el tipo pero está fuera de la UI
  (`SLEEVE_OPTIONS`): sin manga que la tape, la sisa necesita recortarse y
  ribetearse de verdad en la malla.
- `<Environment>` de drei **suspende**; va envuelto en `<Suspense>` propio.
  Sin ese boundary ningún hijo del `<Canvas>` monta y la escena queda negra.
