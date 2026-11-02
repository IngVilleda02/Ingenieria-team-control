"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; habitual: number | null; extraordinaria: number | null };

/** Conclusión ponderada por persona: habitual y extraordinaria lado a lado. Sin dato = sin barra. */
export function CompareChart({ data }: { data: Row[] }) {
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={3}>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(n: string) => n.split(" ")[0]} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
          <Tooltip formatter={(v) => (v == null ? ["Información insuficiente"] : [`${v}%`])} contentStyle={{ borderRadius: 8, border: "1px solid #e6e9ef", fontSize: 12 }} cursor={{ fill: "#f6f7f9" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="habitual" name="Habitual" fill="#1d3f6e" radius={[3, 3, 0, 0]} maxBarSize={28} />
          <Bar dataKey="extraordinaria" name="Extraordinaria" fill="#4aa8f0" radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
