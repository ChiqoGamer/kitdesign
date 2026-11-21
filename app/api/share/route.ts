import {
  ShareUnavailableError,
  saveSharedDesign,
} from "@/src/server/designStore";

/**
 * Límite de tamaño: los escudos van como dataURL y pueden pesar. Queda por
 * debajo de los 4.5 MB que Vercel acepta como cuerpo de una función, así el
 * usuario ve nuestro mensaje y no un error genérico de la plataforma.
 */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return Response.json(
      { error: "El diseño es demasiado grande para compartir." },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const record = await saveSharedDesign(payload);
    return Response.json({ slug: record.slug });
  } catch (err) {
    if (err instanceof ShareUnavailableError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("No se pudo guardar el diseño compartido", err);
    return Response.json(
      { error: "No se pudo crear el link. Probá de nuevo en un rato." },
      { status: 500 },
    );
  }
}
