"use client";

import { useOptimistic, useTransition } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { checklistToggleAction } from "@/app/(app)/actions";

export function ChecklistItem({ id, text, done }: { id: string; text: string; done: boolean }) {
  const [on, set] = useOptimistic(done);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(async () => { set(!on); await checklistToggleAction(id); })}
      className="group flex w-full items-start gap-2.5 rounded-md px-1 py-1 text-left hover:bg-surface"
      aria-pressed={on}
    >
      <span className={clsx("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition", on ? "border-ok-600 bg-ok-600 text-white" : "border-slate-300 bg-white")}>
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={clsx("text-[13px]", on ? "text-slate-400 line-through" : "text-navy-900")}>{text}</span>
    </button>
  );
}
