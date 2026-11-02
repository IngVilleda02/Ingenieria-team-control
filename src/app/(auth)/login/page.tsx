import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/server/auth";
import { needsSetup } from "@/server/services/setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  if (await needsSetup()) redirect("/setup");
  if (await getSession()) redirect("/");
  return (
    <>
      <h1 className="text-base font-semibold text-navy-900">Iniciar sesión</h1>
      <p className="mb-5 mt-1 text-xs text-slate-500">Acceso del administrador.</p>
      <AuthForm
        endpoint="/api/v1/auth/login"
        submit="Entrar"
        fields={[
          { name: "email", label: "Correo", type: "email", autoComplete: "username", required: true },
          { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password", required: true },
        ]}
      />
    </>
  );
}
