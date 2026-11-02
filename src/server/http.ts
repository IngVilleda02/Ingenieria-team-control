import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./errors";

/** Envuelve una ruta: traduce errores conocidos a respuestas JSON sin filtrar detalles internos. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "Datos no válidos.", fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 422 },
        );
      }
      console.error(e);
      return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
    }
  };
}
