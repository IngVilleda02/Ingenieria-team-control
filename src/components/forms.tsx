"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import clsx from "clsx";
import { AlertTriangle, Loader2 } from "lucide-react";

export type ActionState = { error?: string | null; ok?: string | null; data?: unknown };
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const Pending = createContext(false);

/**
 * Formulario con estado. Se envía manualmente para que React no limpie los campos si hay error.
 * Si la acción devuelve una advertencia de carga, muestra «Continuar de todos modos».
 */
export function ActionForm({
  action, children, className, resetOnOk, confirm,
}: { action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean; confirm?: string }) {
  const [state, dispatch, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  const warning = (state.data as { warning?: string } | undefined)?.warning;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    startTransition(() => dispatch(fd));
  }

  return (
    <Pending.Provider value={pending}>
      <form ref={ref} onSubmit={submit} className={className}>
        {children}
        {warning && (
          <div role="alert" className="mt-3 rounded-lg border border-yellow-200 bg-warn-50 p-3 text-xs text-warn-700">
            <p className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{warning}</p>
            <div className="mt-2 flex gap-2">
              <Submit name="confirmed" value="1" variant="soft">Continuar de todos modos</Submit>
            </div>
          </div>
        )}
        {state.error && <p role="alert" className="mt-2 rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad-700">{state.error}</p>}
        {state.ok && <p role="status" className="mt-2 rounded-lg bg-ok-50 px-3 py-2 text-xs text-ok-700">{state.ok}</p>}
      </form>
    </Pending.Provider>
  );
}

export function Submit({ children, variant = "primary", className, name, value, title }: { children: React.ReactNode; variant?: "primary" | "ghost" | "danger" | "soft"; className?: string; name?: string; value?: string; title?: string }) {
  const pending = useContext(Pending);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      disabled={pending}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition disabled:opacity-60",
        variant === "primary" && "bg-navy-800 text-white hover:bg-navy-700",
        variant === "ghost" && "text-slate-600 hover:bg-surface hover:text-navy-900",
        variant === "soft" && "bg-white text-navy-800 ring-1 ring-inset ring-line hover:bg-navy-50",
        variant === "danger" && "bg-bad-50 text-bad-700 ring-1 ring-inset ring-red-200 hover:bg-red-100",
        className,
      )}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
