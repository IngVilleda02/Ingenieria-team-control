import { FileText, ImageIcon } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

type Ev = { id: string; originalName: string; mime: string; sizeBytes: number; description: string | null; createdAt: Date };

export function EvidenceList({ items, tz }: { items: Ev[]; tz: string }) {
  if (!items.length) return <p className="px-4 py-4 text-xs text-slate-500">Sin evidencias.</p>;
  return (
    <ul className="grid gap-2 p-3 sm:grid-cols-2">
      {items.map((e) => {
        const img = e.mime.startsWith("image/");
        return (
          <li key={e.id}>
            <a href={`/api/v1/evidence/${e.id}`} target="_blank" rel="noopener" className="flex gap-3 rounded-lg border border-line p-2 hover:bg-surface">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/v1/evidence/${e.id}`} alt={e.description ?? e.originalName} className="h-12 w-12 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-surface">{img ? <ImageIcon className="h-5 w-5 text-slate-400" /> : <FileText className="h-5 w-5 text-slate-400" />}</span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-navy-900">{e.originalName}</span>
                {e.description && <span className="block truncate text-2xs text-slate-600">{e.description}</span>}
                <span className="block text-2xs text-slate-500">{(e.sizeBytes / 1024).toFixed(0)} KB · {fmtDateTime(e.createdAt, tz)}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
