"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef } from "react";
import { Loader2, Send } from "lucide-react";
import { askAction } from "@/app/(app)/more-actions";
import { Markdown } from "@/components/Markdown";

const EXAMPLES = [
  "¿Qué actividades tengo pendientes hoy?",
  "¿Qué proyectos están atrasados?",
  "Genera un resumen del cumplimiento de los tres colaboradores.",
  "¿Qué actividades están consumiendo más tiempo?",
  "Reprograma las actividades pendientes de esta semana para la próxima, pero primero muéstrame una propuesta.",
];

export function AssistantChat({ enabled }: { enabled: boolean }) {
  const [state, dispatch, pending] = useActionState(askAction, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  const data = state.data as { answer: string; proposalId: string | null } | undefined;
  const ask = (q: string) => {
    const fd = new FormData();
    fd.set("question", q);
    startTransition(() => dispatch(fd));
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ref.current?.value.trim()) ask(ref.current.value);
        }}
        className="flex gap-2"
      >
        <textarea ref={ref} name="question" rows={2} disabled={!enabled} placeholder={enabled ? "Pregunta sobre tus proyectos, tu equipo o tus pendientes…" : "Configura AI_API_KEY para usar el asistente"} className="flex-1 resize-none rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-surface" />
        <button disabled={!enabled || pending} className="grid w-11 place-items-center rounded-lg bg-navy-800 text-white disabled:opacity-50" aria-label="Enviar">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" disabled={!enabled || pending} onClick={() => { if (ref.current) ref.current.value = e; ask(e); }} className="rounded-full border border-line px-2.5 py-1 text-2xs text-slate-600 hover:bg-surface disabled:opacity-50">{e}</button>
        ))}
      </div>
      {state.error && <p role="alert" className="mt-3 rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad-700">{state.error}</p>}
      {data && (
        <div className="mt-4 rounded-lg border border-line bg-surface/50 p-4">
          <Markdown text={data.answer} />
          {data.proposalId && (
            <Link href={`/asistente/propuesta/${data.proposalId}`} className="mt-3 inline-flex rounded-lg bg-navy-800 px-3 py-2 text-[13px] font-medium text-white hover:bg-navy-700">Revisar propuesta antes de aplicar</Link>
          )}
        </div>
      )}
    </div>
  );
}
