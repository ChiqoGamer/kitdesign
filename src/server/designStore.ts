import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
 */

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
  await mkdir(DATA_DIR, { recursive: true });
  const slug = makeSlug();
  const record: SharedDesign = {
    slug,
    createdAt: new Date().toISOString(),
    payload,
  };
  await writeFile(path.join(DATA_DIR, `${slug}.json`), JSON.stringify(record), "utf8");
  return record;
}

export async function loadSharedDesign(
  slug: string,
): Promise<SharedDesign | null> {
  if (!isValidSlug(slug)) return null;
  try {
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
