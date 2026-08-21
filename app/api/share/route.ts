import { saveSharedDesign } from "@/src/server/designStore";

/** Límite de tamaño: los escudos van como dataURL y pueden pesar. */
const MAX_BYTES = 6 * 1024 * 1024;

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

  const record = await saveSharedDesign(payload);
  return Response.json({ slug: record.slug });
}
