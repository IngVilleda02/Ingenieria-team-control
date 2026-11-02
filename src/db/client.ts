import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";
import { databaseUrl } from "./url";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export type Db = PgliteDatabase<typeof schema>;

type Holder = { promise?: Promise<Db> };
const holder = globalThis as unknown as { __itcDb?: Holder };
holder.__itcDb ??= {};

async function connect(): Promise<Db> {
  const url = databaseUrl();
  if (!url && process.env.VERCEL) {
    // En Vercel el disco es de solo lectura: sin base en la nube los datos se perderían.
    throw new Error("Falta DATABASE_URL: conecta una base Neon en Vercel → Storage.");
  }

  if (url) {
    // Nube (Vercel + Neon). Las migraciones se aplican en el build (npm run db:migrate).
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: url });
    return drizzle(pool, { schema }) as unknown as Db;
  }

  // Local: PostgreSQL embebido (PGlite) en ./data/pglite. Se migra al arrancar.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pglite");
  if (dir !== "memory://") fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

export function getDb(): Promise<Db> {
  holder.__itcDb!.promise ??= connect().catch((err) => {
    holder.__itcDb!.promise = undefined;
    throw err;
  });
  return holder.__itcDb!.promise;
}

export { schema };
