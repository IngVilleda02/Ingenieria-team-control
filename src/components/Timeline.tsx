import Link from "next/link";
import { CheckCircle2, Circle, Clock, MessageSquare, Paperclip, Play, RefreshCw, UserPlus } from "lucide-react";
import { ACTION_LABEL, fmtDateTime, STATUS_LABEL } from "@/lib/format";
import type { TimelineItem } from "@/server/services/logbook";

const ICON: Record<string, typeof Circle> = { finish: CheckCircle2, start: Play, comment: MessageSquare, evidence: Paperclip, time: Clock, assign: UserPlus, reschedule: RefreshCw };

export function Timeline({ items, tz }: { items: TimelineItem[]; tz: string }) {
  if (!items.length) return <p className="px-4 py-4 text-xs text-slate-500">Sin movimientos registrados.</p>;
  return (
    <ol className="max-h-[28rem] overflow-y-auto px-4 py-3">
      {items.map((h, i) => {
        const Icon = ICON[h.action] ?? Circle;
        const href = h.entityType === "activity" || h.entityType === "assignment" ? (h.entityId ? `/actividades/${h.entityId}` : null) : h.entityType === "project" && h.entityId ? `/proyectos/${h.entityId}` : h.entityType === "member" && h.entityId ? `/equipo/${h.entityId}` : null;
        const extra = h.detail?.status ? ` → ${STATUS_LABEL[String(h.detail.status)]}` : h.detail?.dueDate ? ` → ${String(h.detail.dueDate)}` : h.detail?.body ? `: “${String(h.detail.body).slice(0, 80)}”` : h.detail?.name ? `: ${String(h.detail.name)}` : "";
        return (
          <li key={h.id} className="relative flex gap-3 pb-3">
            {i < items.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-line" />}
            <Icon className={`relative mt-0.5 h-4 w-4 shrink-0 bg-white ${h.action === "finish" ? "text-ok-600" : "text-slate-400"}`} />
            <div className="min-w-0 text-xs">
              <p className="text-navy-900">
                <span className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</span>{" "}
                {href ? <Link href={href} className="text-sky-600 hover:underline">{h.title ?? ""}</Link> : h.title}
                <span className="text-slate-600">{extra}</span>
              </p>
              <p className="text-2xs text-slate-500">{fmtDateTime(h.at, tz)}{h.user ? ` · ${h.user}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
