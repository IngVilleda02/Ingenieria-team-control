import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={clsx("rounded-xl border border-line bg-white", className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h2 className="text-[13px] font-semibold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const TONES = {
  neutral: "bg-surface text-slate-600 ring-line",
  navy: "bg-navy-50 text-navy-700 ring-navy-100",
  sky: "bg-sky-50 text-sky-600 ring-sky-100",
  ok: "bg-ok-50 text-ok-700 ring-green-200",
  warn: "bg-warn-50 text-warn-700 ring-yellow-200",
  bad: "bg-bad-50 text-bad-700 ring-red-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-medium ring-1 ring-inset", TONES[tone])}>
      {children}
    </span>
  );
}

export function Kpi({
  label, value, hint, tone = "navy", icon: Icon,
}: { label: string; value: React.ReactNode; hint?: string; tone?: "navy" | "ok" | "warn" | "bad" | "sky"; icon?: LucideIcon }) {
  const color = { navy: "text-navy-800", ok: "text-ok-700", warn: "text-warn-700", bad: "text-bad-700", sky: "text-sky-600" }[tone];
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
      </div>
      <div className={clsx("tabular mt-1 text-2xl font-semibold tracking-tight", color)}>{value}</div>
      {hint && <div className="mt-0.5 text-2xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Indicador sin datos suficientes: nunca se inventa un número. */
export function Insufficient({ small }: { small?: boolean }) {
  return (
    <span className={clsx("font-medium text-slate-400", small ? "text-xs" : "text-sm")} title="Faltan actividades completadas para calcularlo">
      Información insuficiente
    </span>
  );
}

export function Progress({ value, tone = "sky" }: { value: number | null; tone?: "sky" | "ok" | "warn" | "bad" }) {
  const bar = { sky: "bg-sky-500", ok: "bg-ok-600", warn: "bg-warn-500", bad: "bg-bad-600" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full", bar)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {Icon && (
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-surface">
          <Icon className="h-4 w-4 text-slate-400" aria-hidden />
        </div>
      )}
      <p className="text-[13px] font-medium text-navy-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-slate-500">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PhaseBadge({ phase }: { phase: number }) {
  return <Badge tone="neutral">Fase {phase}</Badge>;
}
