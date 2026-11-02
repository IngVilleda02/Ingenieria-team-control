/**
 * Reportes PDF y Excel, individuales y generales, por cualquier periodo.
 * Todo sale de los datos registrados; las «recomendaciones» se generan con reglas fijas y se rotulan como tales.
 */
import ExcelJS from "exceljs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { eq } from "drizzle-orm";
import { schema } from "@/db/client";
import type { Ctx } from "../context";
import { HttpError } from "../errors";
import { listEvidence } from "./evidence";
import { memberIndicators, projectProjection, teamIndicators, type Block } from "./indicators";
import { listAssignments } from "./activities";
import { listProjects } from "./projects";
import { addDays, todayIn } from "./metrics";
import { getSettings } from "./settings";
import { ORIGIN_LABEL, PRIORITY_LABEL, PROJECT_STATUS_LABEL, STATUS_LABEL } from "@/lib/format";

export type ReportKind = "individual" | "general" | "proyecto";
export type Period = { from: string; to: string; label: string };

export async function periodFrom(preset: string, from?: string | null, to?: string | null): Promise<Period> {
  const today = todayIn((await getSettings()).timezone);
  if (preset === "personalizado" && from && to) return { from, to, label: `${from} a ${to}` };
  if (preset === "diario") return { from: today, to: today, label: `Diario ${today}` };
  if (preset === "mensual") return { from: addDays(today, -29), to: today, label: `Últimos 30 días al ${today}` };
  return { from: addDays(today, -6), to: today, label: `Semanal ${addDays(today, -6)} a ${today}` };
}

const pctTxt = (v: number | null) => (v == null ? "Información insuficiente" : `${v}%`);
const h = (v: number | null) => (v == null ? "—" : `${v} h`);

function blockRows(b: Block): [string, string][] {
  return [
    ["Asignadas", String(b.total)], ["Completadas", String(b.completed)], ["Pendientes", String(b.pending)], ["Vencidas", String(b.overdue)],
    ["Conclusión ponderada", pctTxt(b.completion)], ["Cumplimiento de fechas", pctTxt(b.onTime)], ["Eficiencia de tiempo", pctTxt(b.efficiency)],
    ["Tiempo promedio", b.avgHours == null ? "Información insuficiente" : `${b.avgHours} h`], ["Horas estimadas / reales", `${b.estimatedH} / ${b.actualH} h`],
  ];
}

export async function buildReport(c: Ctx, kind: ReportKind, period: Period, target?: string | null) {
  const s = await getSettings();
  if (kind === "individual") {
    if (!target) throw new HttpError(422, "Elige al colaborador.");
    const [m] = await c.db.select().from(schema.member).where(eq(schema.member.id, target));
    if (!m) throw new HttpError(404, "Colaborador no encontrado.");
    const ind = await memberIndicators(c, target, period.from, period.to);
    const ev = await listEvidence(c, { memberId: target, from: period.from, to: period.to });
    return {
      title: `Reporte individual · ${m.fullName}`,
      subtitle: `${[m.position, m.area].filter(Boolean).join(" · ")} · ${period.label}`,
      sections: [
        { title: "Resumen", rows: blockRows(ind.all) },
        { title: "Actividades habituales", rows: blockRows(ind.habitual) },
        { title: "Actividades extraordinarias", rows: blockRows(ind.extraordinaria) },
      ],
      table: {
        title: "Actividades del periodo",
        head: ["Actividad", "Tipo", "Prioridad", "Estado", "Límite", "Est. h", "Real h"],
        rows: ind.items.map((i) => [i.title, ORIGIN_LABEL[i.origin], PRIORITY_LABEL[i.priority], i.overdue ? "Vencida" : STATUS_LABEL[i.status], i.dueDate ?? "—", i.estimatedH ?? "", i.actualH ?? ""]),
      },
      extra: { title: "Evidencias", head: ["Archivo", "Actividad", "Fecha"], rows: ev.map((e) => [e.e.originalName, e.activityTitle ?? "—", e.e.createdAt.toISOString().slice(0, 10)]) },
      notes: [] as string[],
    };
  }
  if (kind === "proyecto") {
    if (!target) throw new HttpError(422, "Elige el proyecto.");
    const projects = await listProjects(c);
    const p = projects.find((x) => x.id === target);
    if (!p) throw new HttpError(404, "Proyecto no encontrado.");
    const items = await listAssignments(c, { projectId: target });
    const m = projectProjection(p, items, s);
    return {
      title: `Reporte de proyecto · ${p.name}`,
      subtitle: `${PROJECT_STATUS_LABEL[p.status]} · ${period.label}`,
      sections: [{ title: "Avance y eficiencia", rows: [["Avance real", pctTxt(p.progress)], ["Tiempo transcurrido", pctTxt(m.elapsedPct)], ["Desviación (pts)", m.variance == null ? "—" : String(m.variance)], ["Pendientes", String(m.pendingCount)], ["Vencidas", String(m.overdueCount)], ["Fecha límite", p.dueDate ?? "—"], ["Cierre proyectado", m.projectedEnd ?? "Información insuficiente"], ["Entregas a tiempo", pctTxt(m.onTime)]] as [string, string][] }],
      table: { title: "Actividades", head: ["Actividad", "Responsable", "Tipo", "Estado", "Límite", "Avance"], rows: items.map((i) => [i.title, i.memberName, ORIGIN_LABEL[i.origin], i.overdue ? "Vencida" : STATUS_LABEL[i.status], i.dueDate ?? "—", `${i.progressPct}%`]) },
      extra: null,
      notes: m.atRisk ? ["[Recomendación] El proyecto va detrás del plan o su cierre proyectado supera la fecha límite: revisa alcance, recursos o fecha."] : [],
    };
  }
  // General
  const ind = await teamIndicators(c, period.from, period.to);
  const projects = (await listProjects(c)).filter((p) => !["completado", "cancelado"].includes(p.status));
  const all = await listAssignments(c);
  const delays = all.filter((a) => a.overdue).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 15);
  const notes: string[] = [];
  for (const r of ind.rows) {
    if (r.workload.level === "sobrecarga") notes.push(`[Recomendación] ${r.name} está en sobrecarga (${r.workload.pendingH} h pendientes de ${r.workload.availableH} h disponibles): redistribuye o mueve fechas.`);
    if (r.all.overdue >= 3) notes.push(`[Recomendación] ${r.name} acumula ${r.all.overdue} actividades vencidas: agenda un seguimiento.`);
    if (r.extraordinaria.completion != null && r.habitual.completion != null && r.extraordinaria.completion < r.habitual.completion - 25)
      notes.push(`[Recomendación] El cumplimiento extraordinario de ${r.name} (${r.extraordinaria.completion}%) va muy por debajo del habitual (${r.habitual.completion}%): revisa si la carga adicional es realista.`);
  }
  for (const p of projects) if (p.late) notes.push(`[Recomendación] El proyecto «${p.name}» superó su fecha estimada: actualiza fecha o alcance.`);
  return {
    title: "Reporte general del equipo",
    subtitle: period.label,
    sections: [
      { title: "Equipo · habituales", rows: blockRows(ind.team.habitual) },
      { title: "Equipo · extraordinarias", rows: blockRows(ind.team.extraordinaria) },
      { title: "Cumplimiento por colaborador", rows: ind.rows.map((r) => [r.name, `Habitual ${pctTxt(r.habitual.completion)} · Extraordinaria ${pctTxt(r.extraordinaria.completion)} · A tiempo ${pctTxt(r.all.onTime)} · Eficiencia ${pctTxt(r.all.efficiency)}`] as [string, string]) },
    ],
    table: { title: "Proyectos activos", head: ["Proyecto", "Estado", "Avance", "Abiertas", "Vencidas", "Límite"], rows: projects.map((p) => [p.name, PROJECT_STATUS_LABEL[p.status], p.progress == null ? "—" : `${p.progress}%`, p.openCount, p.overdueCount, p.dueDate ?? "—"]) },
    extra: { title: "Principales retrasos", head: ["Actividad", "Responsable", "Tipo", "Venció"], rows: delays.map((d) => [d.title, d.memberName, ORIGIN_LABEL[d.origin], d.dueDate ?? "—"]) },
    notes: notes.length ? notes : ["Sin alertas que requieran acción en este periodo."],
  };
}

type Report = Awaited<ReturnType<typeof buildReport>>;

// ── PDF ──────────────────────────────────────────────────────────────────────
const NAVY = rgb(0.063, 0.145, 0.259);
const GREY = rgb(0.4, 0.45, 0.52);
const LINE = rgb(0.9, 0.91, 0.94);
/** Helvetica estándar cubre español (WinAnsi); se sustituyen símbolos fuera de ese juego. */
const safe = (s: unknown) => String(s ?? "").replace(/[→]/g, "->").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

export async function toPdf(r: Report, generatedAt: string) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 42;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const ensure = (need: number) => {
    if (y - need < M) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (s: string, x: number, size: number, f: PDFFont = font, color = NAVY, maxW?: number) => {
    let t = safe(s);
    if (maxW && f.widthOfTextAtSize(t, size) > maxW) {
      while (t.length > 1 && f.widthOfTextAtSize(`${t}...`, size) > maxW) t = t.slice(0, -1);
      t = `${t.trimEnd()}...`;
    }
    page.drawText(t, { x, y, size, font: f, color });
  };
  const wrap = (s: string, size: number, maxW: number) => {
    const words = safe(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: NAVY });
  text("INGENIERÍA TEAM CONTROL", M, 9, bold, GREY);
  y -= 22;
  text(r.title, M, 17, bold);
  y -= 16;
  text(r.subtitle, M, 10, font, GREY, W - 2 * M);
  y -= 12;
  text(`Generado ${generatedAt} · datos registrados en el sistema`, M, 8, font, GREY);
  y -= 22;

  for (const sec of r.sections) {
    ensure(30 + sec.rows.length * 14);
    text(sec.title, M, 11, bold);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
    y -= 13;
    for (const [k, v] of sec.rows) {
      const lines = wrap(v, 9, W - 2 * M - 190);
      ensure(lines.length * 12 + 2);
      text(k, M, 9, font, GREY, 180);
      for (const [i, l] of lines.entries()) {
        page.drawText(l, { x: M + 190, y: y - i * 12, size: 9, font, color: NAVY });
      }
      y -= Math.max(1, lines.length) * 12 + 2;
    }
    y -= 10;
  }

  const table = (t: { title: string; head: string[]; rows: unknown[][] }) => {
    ensure(50);
    text(t.title, M, 11, bold);
    y -= 16;
    const n = t.head.length;
    const first = (W - 2 * M) * (n > 4 ? 0.36 : 0.45);
    const rest = (W - 2 * M - first) / (n - 1);
    const xs = t.head.map((_, i) => (i === 0 ? M : M + first + (i - 1) * rest));
    const widths = t.head.map((_, i) => (i === 0 ? first - 6 : rest - 6));
    const header = () => {
      page.drawRectangle({ x: M - 4, y: y - 4, width: W - 2 * M + 8, height: 16, color: rgb(0.965, 0.97, 0.98) });
      t.head.forEach((hh, i) => text(hh, xs[i], 8, bold, GREY, widths[i]));
      y -= 16;
    };
    header();
    if (!t.rows.length) {
      text("Sin registros en el periodo.", M, 9, font, GREY);
      y -= 14;
    }
    for (const row of t.rows) {
      if (y < M + 16) {
        page = doc.addPage([W, H]);
        y = H - M;
        header();
      }
      row.forEach((cell, i) => text(String(cell ?? ""), xs[i], 8.5, font, NAVY, widths[i]));
      y -= 4;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE });
      y -= 10;
    }
    y -= 12;
  };
  table(r.table);
  if (r.extra) table(r.extra);
  if (r.notes.length) {
    ensure(40);
    text("Recomendaciones", M, 11, bold);
    y -= 16;
    for (const nt of r.notes) {
      const lines = wrap(nt, 9, W - 2 * M);
      ensure(lines.length * 12 + 4);
      for (const l of lines) {
        page.drawText(l, { x: M, y, size: 9, font, color: NAVY });
        y -= 12;
      }
      y -= 4;
    }
  }
  const pages = doc.getPages();
  pages.forEach((pg, i) => pg.drawText(safe(`Página ${i + 1} de ${pages.length}`), { x: W - M - 70, y: 22, size: 8, font, color: GREY }));
  return Buffer.from(await doc.save());
}

// ── Excel ────────────────────────────────────────────────────────────────────
export async function toXlsx(r: Report, generatedAt: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ingeniería Team Control";
  const sum = wb.addWorksheet("Resumen");
  sum.columns = [{ width: 34 }, { width: 80 }];
  sum.addRow([r.title]).font = { bold: true, size: 14, color: { argb: "FF102542" } };
  sum.addRow([r.subtitle]);
  sum.addRow([`Generado ${generatedAt}`]);
  for (const sec of r.sections) {
    sum.addRow([]);
    sum.addRow([sec.title]).font = { bold: true, color: { argb: "FF102542" } };
    for (const row of sec.rows) sum.addRow(row);
  }
  if (r.notes.length) {
    sum.addRow([]);
    sum.addRow(["Recomendaciones"]).font = { bold: true };
    for (const n of r.notes) sum.addRow([n]);
  }
  const sheet = (t: { title: string; head: string[]; rows: unknown[][] }) => {
    const ws = wb.addWorksheet(t.title.slice(0, 31));
    ws.addRow(t.head);
    const hr = ws.getRow(1);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" } };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF102542" } };
    for (const row of t.rows) ws.addRow(row.map((c) => (c === "" ? null : c)));
    ws.columns.forEach((col, i) => (col.width = i === 0 ? 46 : 16));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.head.length } };
  };
  sheet(r.table);
  if (r.extra) sheet(r.extra);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
