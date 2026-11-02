import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/** Almacenamiento de evidencias: Vercel Blob en la nube, carpeta data/evidence en la laptop. */
export const cloudStorage = () => !!process.env.BLOB_READ_WRITE_TOKEN;

const ROOT = () => process.env.EVIDENCE_DIR ?? path.join(process.cwd(), "data", "evidence");

export async function putFile(key: string, body: Buffer, contentType: string): Promise<string> {
  if (cloudStorage()) {
    const { put } = await import("@vercel/blob");
    const res = await put(`evidence/${key}`, body, { access: "public", contentType, addRandomSuffix: true });
    return res.url;
  }
  const full = path.join(ROOT(), key);
  if (!full.startsWith(ROOT())) throw new Error("Ruta no válida");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body, { flag: "wx" });
  return `local:${key}`;
}

export async function readFile(storageKey: string): Promise<Buffer | { redirect: string }> {
  if (storageKey.startsWith("local:")) {
    const full = path.join(ROOT(), storageKey.slice(6));
    if (!full.startsWith(ROOT())) throw new Error("Ruta no válida");
    return fs.readFile(full);
  }
  return { redirect: storageKey };
}
