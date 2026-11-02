"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { label: string; habitual: number; extraordinaria: number; personal?: number };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmt = (l: string) => (l.length === 7 ? `${MONTHS[Number(l.slice(5, 7)) - 1]} ${l.slice(2, 4)}` : `${Number(l.slice(8))} ${MONTHS[Number(l.slice(5, 7)) - 1]}`);

/** Esfuerzo ponderado completado: habitual y extraordinaria lado a lado, nunca mezcladas. */
export function OriginSeriesChart({ data, showPersonal = false }: { data: P[]; showPersonal?: boolean }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="label" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip labelFormatter={(l) => fmt(String(l))} formatter={(v) => [`${v} pts`]} contentStyle={{ borderRadius: 8, border: "1px solid #e6e9ef", fontSize: 12 }} cursor={{ fill: "#f6f7f9" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="habitual" name="Habitual" fill="#1d3f6e" radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="extraordinaria" name="Extraordinaria" fill="#4aa8f0" radius={[3, 3, 0, 0]} maxBarSize={18} />
          {showPersonal && <Bar dataKey="personal" name="Personal" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={18} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
