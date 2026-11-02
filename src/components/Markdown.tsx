/** Render mínimo y seguro de markdown (negritas, listas, saltos). No inyecta HTML. */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const inline = (s: string, k: number) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${k}-${i}`} className={/^\*\*\[(Registrado|Estimado|Recomendación)\]\*\*$/.test(part) ? tagClass(part) : "font-semibold text-navy-900"}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={`${k}-${i}`}>{part}</span>
      ),
    );
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-slate-700">
      {lines.map((l, i) =>
        /^\s*[-*•]\s+/.test(l) ? (
          <p key={i} className="flex gap-2 pl-1"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" /><span>{inline(l.replace(/^\s*[-*•]\s+/, ""), i)}</span></p>
        ) : /^#{1,4}\s/.test(l) ? (
          <p key={i} className="pt-1 font-semibold text-navy-900">{l.replace(/^#+\s/, "")}</p>
        ) : l.trim() ? (
          <p key={i}>{inline(l, i)}</p>
        ) : null,
      )}
    </div>
  );
}
function tagClass(p: string) {
  const base = "mr-1 rounded px-1 py-0.5 text-2xs font-medium";
  if (p.includes("Registrado")) return `${base} bg-navy-50 text-navy-700`;
  if (p.includes("Estimado")) return `${base} bg-sky-50 text-sky-600`;
  return `${base} bg-warn-50 text-warn-700`;
}
