export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-[11px] font-bold tracking-wide text-white">ITC</div>
          <div>
            <p className="text-sm font-semibold leading-tight text-navy-900">Ingeniería Team Control</p>
            <p className="text-2xs text-slate-500">Proyectos, actividades y equipo</p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
