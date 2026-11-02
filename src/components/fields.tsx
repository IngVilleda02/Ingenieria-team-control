import Link from "next/link";
import clsx from "clsx";

const input =
  "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx("block", className)}>
      <span className="text-xs font-medium text-navy-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(input, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={clsx(input, "resize-y", props.className)} />;
}
export function Select({ options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...props} className={clsx(input, "pr-8", props.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Checkbox({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-navy-900">
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-line text-navy-800 focus:ring-sky-200" />
      {label}
    </label>
  );
}

/** Barra de filtros por GET: los filtros quedan en la URL y se pueden compartir o recargar. */
export function FilterBar({ children, action }: { children: React.ReactNode; action?: string }) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-surface/60 p-3">
      {children}
      <button className="rounded-lg bg-white px-3 py-2 text-[13px] font-medium text-navy-800 ring-1 ring-inset ring-line hover:bg-navy-50">Aplicar</button>
    </form>
  );
}

export function MiniSelect({ name, value, options, label }: { name: string; value?: string | null; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="block min-w-[140px] flex-1 sm:flex-none">
      <span className="text-2xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="mt-1 block w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[13px]">
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon }: { title: string; subtitle?: string; actions?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-navy-700" />}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "soft" }) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition",
        variant === "primary" ? "bg-navy-800 text-white hover:bg-navy-700" : "bg-white text-navy-800 ring-1 ring-inset ring-line hover:bg-navy-50",
      )}
    >
      {children}
    </Link>
  );
}
