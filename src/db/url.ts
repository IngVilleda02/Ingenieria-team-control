/** URL de PostgreSQL en la nube. Neon en Vercel puede crear DATABASE_URL o POSTGRES_URL. */
export function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim() || null;
}
