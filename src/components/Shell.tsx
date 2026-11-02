"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { NAV } from "@/lib/nav";
import { Logo } from "@/components/Logo";

export function Shell({ user, unread, children }: { user: { name: string; role: string }; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const initials = user.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3" aria-label="Secciones">
      {NAV.map((item) => {
        const href = `/${item.slug}`;
        const active = item.slug === "" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={item.slug}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
              active ? "bg-navy-800 font-medium text-white" : "text-slate-600 hover:bg-surface hover:text-navy-900",
            )}
          >
            <item.icon className={clsx("h-4 w-4 shrink-0", active ? "text-sky-100" : "text-slate-400 group-hover:text-navy-600")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.slug === "recordatorios" && unread > 0 && (
              <span className="tabular rounded-full bg-bad-600 px-1.5 text-2xs font-medium text-white">{unread > 99 ? "99+" : unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
      <Logo className="h-7 w-7 shrink-0" />
      <div className="flex-1 leading-tight">
        <p className="text-[13px] font-semibold text-navy-900">Ingeniería</p>
        <p className="text-2xs text-slate-500">Team Control</p>
      </div>
      <Link href="/recordatorios" onClick={() => setOpen(false)} className="relative rounded-md p-1.5 text-slate-500 hover:bg-surface hover:text-navy-900" aria-label={`Notificaciones${unread ? `: ${unread} sin leer` : ""}`}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bad-600" />}
      </Link>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2.5 border-t border-line px-3 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-50 text-xs font-semibold text-navy-700">{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-navy-900">{user.name}</p>
        <p className="text-2xs text-slate-500">{user.role}</p>
      </div>
      <button onClick={logout} className="rounded-md p-1.5 text-slate-400 hover:bg-surface hover:text-navy-900" aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white lg:flex">
      {/* Escritorio */}
      <aside className="sticky top-0 z-30 hidden h-screen w-60 shrink-0 flex-col self-start border-r border-line bg-white lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Móvil / tablet */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-navy-900 hover:bg-surface" aria-label="Abrir menú">
          <Menu className="h-5 w-5" />
        </button>
        <p className="flex-1 text-sm font-semibold text-navy-900">Ingeniería Team Control</p>
        <Link href="/recordatorios" className="relative rounded-md p-1.5 text-slate-500" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-bad-600" />}
        </Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-navy-900/30" onClick={() => setOpen(false)} aria-label="Cerrar menú" />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3.5 rounded-md p-1.5 text-slate-500 hover:bg-surface" aria-label="Cerrar menú">
              <X className="h-4 w-4" />
            </button>
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
