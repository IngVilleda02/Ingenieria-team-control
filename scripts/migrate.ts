/** Aplica migraciones a la base de la nube (Neon). En local la app migra sola al arrancar. */
import path from "node:path";

async function main() {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) {
    if (process.env.VERCEL) {
      console.error("Falta DATABASE_URL. En Vercel: Storage → Create Database → Neon, conéctala al proyecto y vuelve a desplegar.");
      process.exit(1);
    }
    console.log("DATABASE_URL vacío: se usará PGlite local, que se migra al iniciar la app.");
    return;
  }
  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await pool.end();
  console.log("Migraciones aplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
