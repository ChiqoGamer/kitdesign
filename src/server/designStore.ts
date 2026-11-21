import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

/**
 * ALMACÉN DE DISEÑOS COMPARTIDOS
 * ==============================
 * Guarda el diseño en disco y devuelve un slug para armar el link público.
 *
 * Es deliberadamente un almacén de archivos: la forma del dato ya es el
 * JSON del DesignState, así que mover esto a Postgres más adelante es
 * cambiar estas dos funciones y nada más. No sirve para producción con
 * varias instancias — es el paso mínimo para que un club pueda mandarle el
 * link a su grupo, que es lo que estamos validando.
 *
 * En Vercel el disco es de sólo lectura y cada función corre en su propia
 * instancia, así que ahí se usa Vercel Blob (privado: el JSON sólo se lee
 * desde el servidor, a través del link de la app). Se activa solo cuando
 * existe BLOB_READ_WRITE_TOKEN, que Vercel inyecta al conectar un store al
 * proyecto. En local, sin token, sigue escribiendo en `.data/`.
 */

const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const blobPath = (slug: string) => `designs/${slug}.json`;

/** Error con un mensaje que se puede mostrar al usuario tal cual. */
export class ShareUnavailableError extends Error {}

const DATA_DIR = path.join(process.cwd(), ".data", "designs");

/** Slug corto y legible, sin caracteres ambiguos. */
function makeSlug(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Sólo slugs de nuestro alfabeto: evita traversal por el nombre. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z2-9]{6,16}$/.test(slug);
}

export interface SharedDesign {
  slug: string;
  createdAt: string;
  /** El DesignState serializado tal cual lo produce el editor. */
  payload: unknown;
}

export async function saveSharedDesign(payload: unknown): Promise<SharedDesign> {
  const slug = makeSlug();
  const record: SharedDesign = {
    slug,
    createdAt: new Date().toISOString(),
    payload,
  };
  if (blobEnabled()) {
    await put(blobPath(slug), JSON.stringify(record), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
    });
    return record;
  }
  if (process.env.VERCEL) {
    // Sin store conectado, escribir en disco fallaría con un error críptico.
    throw new ShareUnavailableError(
      "Compartir todavía no está habilitado en este sitio.",
    );
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(record), "utf8");
  return record;
}

export async function loadSharedDesign(
  slug: string,
): Promise<SharedDesign | null> {
  if (!isValidSlug(slug)) return null;
  try {
    if (blobEnabled()) {
      const result = await get(blobPath(slug), { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      const raw = await new Response(result.stream).text();
      return JSON.parse(raw) as SharedDesign;
    }
    const raw = await readFile(path.join(DATA_DIR, `${slug}.json`), "utf8");
    return JSON.parse(raw) as SharedDesign;
  } catch {
    return null;
  }
}

/** Hash del contenido, para no crear un link nuevo si nada cambió. */
export function fingerprint(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}
