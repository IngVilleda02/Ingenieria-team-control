"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import { moveCardAction } from "@/app/(app)/actions";
import { STATUS_LABEL, ORIGIN_LABEL, PRIORITY_LABEL } from "@/lib/format";

export type Card = {
  assignmentId: string; activityId: string; title: string; status: string; origin: string; priority: string;
  memberName: string; projectName: string | null; dueDate: string | null; overdue: boolean; progressPct: number;
};

const LIMIT_DONE = 15;
const COLUMNS = ["pendiente", "en_proceso", "en_espera", "bloqueada", "en_revision", "completada"] as const;
const DOT: Record<string, string> = { pendiente: "bg-slate-400", en_proceso: "bg-sky-500", en_espera: "bg-warn-500", bloqueada: "bg-bad-600", en_revision: "bg-navy-600", completada: "bg-ok-600" };

export function Kanban({ cards }: { cards: Card[] }) {
  const [items, move] = useOptimistic(cards, (state, { id, status }: { id: string; status: string }) =>
    state.map((c) => (c.assignmentId === id ? { ...c, status } : c)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function drop(status: string, id: string) {
    setOver(null);
    const card = items.find((c) => c.assignmentId === id);
    if (!card || card.status === status) return;
    setError(null);
    start(async () => {
      move({ id, status });
      const r = await moveCardAction(id, status);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad-700">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((col) => {
          const all = items.filter((c) => c.status === col);
          const list = col === "completada" ? all.slice(-LIMIT_DONE) : all;
          return (
            <section
              key={col}
              onDragOver={(e) => { e.preventDefault(); setOver(col); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => drop(col, e.dataTransfer.getData("text/plain"))}
              className={clsx("flex w-64 shrink-0 flex-col rounded-xl border bg-surface/70 transition xl:w-auto xl:min-w-[170px] xl:flex-1", over === col ? "border-sky-400 bg-sky-50" : "border-line")}
              aria-label={STATUS_LABEL[col]}
            >
              <header className="flex items-center gap-2 px-3 py-2.5">
                <span className={clsx("h-2 w-2 rounded-full", DOT[col])} />
                <h3 className="text-xs font-semibold text-navy-900">{STATUS_LABEL[col]}</h3>
                <span className="tabular ml-auto text-2xs text-slate-500">{all.length}</span>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {list.map((c) => (
                  <article
                    key={c.assignmentId}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", c.assignmentId)}
                    className={clsx("cursor-grab rounded-lg border bg-white p-2.5 shadow-sm active:cursor-grabbing", c.overdue ? "border-red-200" : "border-line")}
                  >
                    <Link href={`/actividades/${c.activityId}`} className="block text-[13px] font-medium leading-snug text-navy-900 hover:underline">{c.title}</Link>
                    {c.projectName && <p className="mt-0.5 truncate text-2xs text-slate-500">{c.projectName}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-2xs">
                      <span className={clsx("rounded px-1.5 py-0.5", c.origin === "extraordinaria" ? "bg-sky-50 text-sky-600" : c.origin === "personal" ? "bg-navy-50 text-navy-700" : "bg-surface text-slate-600")}>{ORIGIN_LABEL[c.origin]}</span>
                      <span className={clsx("rounded px-1.5 py-0.5", c.priority === "critica" ? "bg-bad-50 text-bad-700" : c.priority === "alta" ? "bg-warn-50 text-warn-700" : "bg-surface text-slate-600")}>{PRIORITY_LABEL[c.priority]}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-2xs text-slate-500">
                      <span className="truncate">{c.memberName}</span>
                      <span className={clsx("tabular", c.overdue && "font-medium text-bad-700")}>{c.dueDate ? c.dueDate.slice(5).split("-").reverse().join("/") : "—"}</span>
                    </div>
                    {c.progressPct > 0 && c.status !== "completada" && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface"><div className="h-full bg-sky-500" style={{ width: `${c.progressPct}%` }} /></div>
                    )}
                    <select
                      aria-label="Mover a"
                      value={c.status}
                      onChange={(e) => drop(e.target.value, c.assignmentId)}
                      className="mt-2 w-full rounded border border-line bg-white px-1.5 py-1 text-2xs text-slate-600 md:hidden"
                    >
                      {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </article>
                ))}
                {all.length > list.length && <p className="px-1 text-2xs text-slate-500">Se muestran las {list.length} más recientes de {all.length}. Usa la vista Lista para ver todas.</p>}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-2 text-2xs text-slate-500">Arrastra una tarjeta para cambiar su estado (en celular usa el selector). Cada cambio queda en el historial.</p>
    </div>
  );
}
