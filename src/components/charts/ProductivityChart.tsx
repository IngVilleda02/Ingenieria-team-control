"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; completadas: number; esfuerzo: number };

const short = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export function ProductivityChart({ data }: { data: Point[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="#eef0f4" />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#f6f7f9" }}
            labelFormatter={(l) => short(String(l))}
            formatter={(v, name) => [v, name === "esfuerzo" ? "Esfuerzo ponderado (h)" : "Completadas"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e6e9ef", fontSize: 12 }}
          />
          <Bar dataKey="esfuerzo" fill="#2b8fe0" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
