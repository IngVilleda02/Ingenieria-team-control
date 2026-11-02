import { NextResponse, type NextRequest } from "next/server";

/**
 * Primera barrera: sin cookie de sesión no se entra a las pantallas internas.
 * La verificación real (firma, expiración, usuario activo, permisos) se hace en el servidor.
 */
const PUBLIC = ["/login", "/setup", "/api/v1/auth/login", "/api/v1/auth/setup", "/api/v1/health", "/api/v1/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (req.cookies.has("itc_session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.svg$).*)"] };
