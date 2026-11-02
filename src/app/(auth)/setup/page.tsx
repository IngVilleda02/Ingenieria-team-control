import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { needsSetup } from "@/server/services/setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración inicial" };

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return (
    <>
      <h1 className="text-base font-semibold text-navy-900">Configuración inicial</h1>
      <p className="mb-5 mt-1 text-xs text-slate-500">Crea la cuenta del administrador. Este paso solo aparece una vez.</p>
      <AuthForm
        endpoint="/api/v1/auth/setup"
        submit="Crear cuenta y entrar"
        fields={[
          { name: "fullName", label: "Nombre completo", autoComplete: "name", required: true },
          { name: "position", label: "Puesto", hint: "Opcional" },
          { name: "area", label: "Área", hint: "Opcional" },
          { name: "email", label: "Correo", type: "email", autoComplete: "username", required: true },
          { name: "password", label: "Contraseña", type: "password", autoComplete: "new-password", required: true, hint: "Mínimo 10 caracteres, con letras y números." },
        ]}
      />
    </>
  );
}
