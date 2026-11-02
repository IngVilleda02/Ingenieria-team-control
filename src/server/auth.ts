import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { databaseUrl } from "@/db/url";
import { HttpError } from "./errors";
import { scopeFor, type PermissionCode, type RoleCode, type Scope } from "./permissions";

export const SESSION_COOKIE = "itc_session";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

let cachedSecret: Uint8Array | null = null;

/** En la nube AUTH_SECRET es obligatorio; en la laptop se genera y guarda en ./data si falta. */
function secret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  let value = process.env.AUTH_SECRET?.trim();
  if (!value) {
    if (databaseUrl()) {
      throw new Error("AUTH_SECRET es obligatorio cuando se usa una base en la nube.");
    }
    const file = path.join(process.cwd(), "data", "auth-secret");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("base64url"), { mode: 0o600 });
    value = fs.readFileSync(file, "utf8").trim();
  }
  if (value.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  cachedSecret = new TextEncoder().encode(value);
  return cachedSecret;
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export type Session = {
  userId: string;
  memberId: string | null;
  role: RoleCode;
  name: string;
  email: string;
};

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !!process.env.VERCEL,
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Lee y verifica la sesión; además confirma que el usuario siga activo en la base. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const db = await getDb();
    const [u] = await db
      .select({ isActive: schema.appUser.isActive })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, String(payload.sub)));
    if (!u?.isActive) return null;
    return {
      userId: String(payload.sub),
      memberId: (payload.memberId as string | null) ?? null,
      role: payload.role as RoleCode,
      name: String(payload.name),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Sesión no válida o expirada.");
  return s;
}

/** Verifica el permiso en el servidor y devuelve el alcance con que debe filtrarse la consulta. */
export async function requirePermission(perm: PermissionCode): Promise<{ session: Session; scope: Scope }> {
  const session = await requireSession();
  const scope = scopeFor(session.role, perm);
  if (!scope) throw new HttpError(403, "No tienes permiso para esta acción.");
  return { session, scope };
}

export async function login(email: string, password: string): Promise<Session> {
  const db = await getDb();
  const rows = await db
    .select({
      user: schema.appUser,
      roleCode: schema.role.code,
      memberName: schema.member.fullName,
    })
    .from(schema.appUser)
    .innerJoin(schema.role, eq(schema.role.id, schema.appUser.roleId))
    .leftJoin(schema.member, eq(schema.member.id, schema.appUser.memberId))
    .where(eq(schema.appUser.email, email.toLowerCase().trim()));
  const row = rows[0];
  const fail = new HttpError(401, "Correo o contraseña incorrectos.");
  if (!row || !row.user.isActive) {
    await bcrypt.hash(password, 12); // tiempo constante aproximado
    throw fail;
  }
  if (row.user.lockedUntil && row.user.lockedUntil > new Date()) {
    throw new HttpError(429, "Cuenta bloqueada temporalmente por intentos fallidos. Intenta en unos minutos.");
  }
  const ok = await verifyPassword(password, row.user.passwordHash);
  if (!ok) {
    const failed = row.user.failedLogins + 1;
    await db
      .update(schema.appUser)
      .set({
        failedLogins: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(schema.appUser.id, row.user.id));
    throw fail;
  }
  await db
    .update(schema.appUser)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.appUser.id, row.user.id));
  return {
    userId: row.user.id,
    memberId: row.user.memberId,
    role: row.roleCode as RoleCode,
    name: row.memberName ?? row.user.email,
    email: row.user.email,
  };
}
