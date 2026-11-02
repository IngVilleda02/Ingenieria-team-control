"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Field = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean; hint?: string };

export function AuthForm({ endpoint, fields, submit }: { endpoint: string; fields: Field[]; submit: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No fue posible continuar.");
        if (Array.isArray(data.fields)) setFieldErrors(Object.fromEntries(data.fields.map((f: { path: string; message: string }) => [f.path, f.message])));
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Sin conexión con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="text-xs font-medium text-navy-900">{f.label}</span>
          <input
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            required={f.required}
            aria-invalid={!!fieldErrors[f.name]}
            className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 aria-[invalid=true]:border-bad-600"
          />
          {fieldErrors[f.name] ? (
            <span className="mt-1 block text-2xs text-bad-700">{fieldErrors[f.name]}</span>
          ) : f.hint ? (
            <span className="mt-1 block text-2xs text-slate-500">{f.hint}</span>
          ) : null}
        </label>
      ))}
      {error && <p role="alert" className="rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad-700">{error}</p>}
      <button
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-800 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submit}
      </button>
    </form>
  );
}
