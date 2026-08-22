# KitDesign

Editor web para que un club amateur diseñe su equipación y la vea en 3D sin
depender de un diseñador.

## Levantarlo

```bash
npm install
npm run dev
```

El editor queda en http://localhost:3000/editor

## Cómo está pensado

La decisión central es que **el layout UV son las piezas de corte de la
prenda**. El mismo canvas genera la textura del visor 3D a 2048 px y, subiendo
`size`, el archivo de impresión a 300 DPI. Eso es lo que evita tener dos
pipelines que se van desincronizando: si algo se ve en el 3D, se imprime igual.

De ahí salen el resto de las decisiones:

- **Los patrones se calculan en espacio de prenda, no de rectángulo**, así una
  raya cruza la costura del costado sin cortarse. Las UVs van parametrizadas
  por longitud de arco, así que las rayas convergen en el hombro como en una
  sublimación real.
- **Las acciones son el único camino de mutación.** La UI despacha acciones y
  nada más; el historial sale de los parches invertibles de Immer, así que
  deshacer y el versionado son la misma máquina. Cuando se sume el agente de
  IA, va a usar exactamente esas acciones: no va a poder hacer nada que un
  usuario no pueda hacer, y todo lo que haga se deshace con Cmd+Z sin código
  extra.
- **El renderer es puro y determinista.** El mismo estado da siempre el mismo
  pixel, lo que hace testeable el editor por snapshot.

## Geometría

Hay dos mallas para la camiseta y comparten el mismo atlas:

- **Procedural** (`packages/garment-geometry`), generada por código: secciones
  supraelípticas, torso loftado partido en islas UV de frente y espalda, manga
  con raíz elíptica que se solapa al torso.
- **De referencia** (`public/models/jersey-ref.glb`), remapeada al atlas
  clasificando sus islas UV con union-find. No alcanza con umbrales en `u`
  porque las islas se solapan.

Que las dos compartan atlas es lo que permite que los anclajes de logos y
números sean independientes del modelo.

## Deuda conocida

- **Guardar es por navegador, no por cuenta.** Usa localStorage; una textura
  importada de 2048² se come sola los ~5 MB disponibles y el editor lo avisa.
- **El almacén de links compartidos escribe archivos** en `.data/designs/`, así
  que no funciona con más de una instancia. Es un reemplazo deliberado de
  Postgres: pasarlo es cambiar dos funciones.
- Los links compartidos son copias congeladas, no siguen al diseño.
- `sleeveless` existe en los tipos pero está oculto de la UI: falta el corte
  real de la sisa.
- La cámara en vista lateral encuadra más cerca de lo que debería.
