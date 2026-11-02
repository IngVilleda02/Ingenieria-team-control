import { describe, expect, it } from "vitest";
import {
  isDueSoon, isOverdue, loadLevel, onTimeRate, remainingHours, timeEfficiency, weight, weightedCompletion, type WorkItem,
} from "@/server/services/metrics";
import { DEFAULT_SETTINGS as S } from "@/server/services/settings";

const base: WorkItem = {
  origin: "habitual", priority: "media", complexity: 2, estimatedH: 2, actualH: null,
  dueDate: "2026-11-10", status: "pendiente", finishedAt: null, progressPct: 0,
};
const item = (o: Partial<WorkItem>): WorkItem => ({ ...base, ...o });

describe("peso de una actividad", () => {
  it("horas × prioridad × complejidad", () => {
    expect(weight(item({ estimatedH: 4, priority: "critica", complexity: 5 }), S)).toBeCloseTo(4 * 1.5 * 1.4);
    expect(weight(item({ estimatedH: 2, priority: "media", complexity: 2 }), S)).toBeCloseTo(1.9);
  });
  it("sin estimación usa 1 h", () => {
    expect(weight(item({ estimatedH: null, priority: "media", complexity: 3 }), S)).toBeCloseTo(1.1);
  });
});

describe("vencimientos", () => {
  it("vencida solo si pasó la fecha y no está cerrada", () => {
    expect(isOverdue(item({ dueDate: "2026-10-30" }), "2026-10-31")).toBe(true);
    expect(isOverdue(item({ dueDate: "2026-10-31" }), "2026-10-31")).toBe(false);
    expect(isOverdue(item({ dueDate: "2026-10-30", status: "completada" }), "2026-10-31")).toBe(false);
    expect(isOverdue(item({ dueDate: null }), "2026-10-31")).toBe(false);
  });
  it("próxima a vencer dentro de la ventana", () => {
    expect(isDueSoon(item({ dueDate: "2026-11-02" }), "2026-10-31", 2)).toBe(true);
    expect(isDueSoon(item({ dueDate: "2026-11-03" }), "2026-10-31", 2)).toBe(false);
  });
});

describe("conclusión ponderada", () => {
  it("una crítica grande pesa más que varias pequeñas", () => {
    const items = [
      item({ estimatedH: 8, priority: "critica", complexity: 5, status: "completada" }),
      item({ estimatedH: 0.5, priority: "baja", complexity: 1 }),
      item({ estimatedH: 0.5, priority: "baja", complexity: 1 }),
      item({ estimatedH: 0.5, priority: "baja", complexity: 1 }),
    ];
    // Por cantidad sería 25 %; ponderado debe ser mucho mayor.
    expect(weightedCompletion(items, S)!).toBeGreaterThan(90);
  });
  it("las canceladas no cuentan y sin datos da null", () => {
    expect(weightedCompletion([item({ status: "cancelada" })], S)).toBeNull();
    expect(weightedCompletion([], S)).toBeNull();
  });
});

describe("indicadores con muestra mínima", () => {
  const done = (o: Partial<WorkItem>) => item({ status: "completada", finishedAt: new Date("2026-11-05T18:00:00Z"), ...o });
  it("Información insuficiente con menos de 3 completadas", () => {
    expect(onTimeRate([done({}), done({})], S, S.timezone)).toBeNull();
    expect(timeEfficiency([done({ actualH: 2 }), done({ actualH: 2 })], S)).toBeNull();
  });
  it("cumplimiento de fechas usa la zona horaria de la planta", () => {
    // 2026-11-11 03:00 UTC = 10 nov 21:00 en Querétaro → a tiempo para límite 10 nov
    const late = done({ dueDate: "2026-11-10", finishedAt: new Date("2026-11-11T03:00:00Z") });
    expect(onTimeRate([late, done({}), done({ dueDate: "2026-11-01" })], S, S.timezone)).toBeCloseTo(66.7);
  });
  it("eficiencia con tope de 200 %", () => {
    const items = [done({ estimatedH: 10, actualH: 1 }), done({ estimatedH: 10, actualH: 1 }), done({ estimatedH: 10, actualH: 1 })];
    expect(timeEfficiency(items, S)).toBe(200);
    expect(timeEfficiency([done({ actualH: 4 }), done({ actualH: 4 }), done({ actualH: 4 })], S)).toBe(50);
  });
});

describe("carga de trabajo", () => {
  it("horas restantes descuentan avance", () => {
    expect(remainingHours([item({ estimatedH: 4, progressPct: 50 }), item({ estimatedH: 2, status: "completada" })])).toBe(2);
  });
  it("niveles", () => {
    const t = S.workload_thresholds;
    expect(loadLevel(2, 10, t)).toBe("baja");
    expect(loadLevel(6, 10, t)).toBe("normal");
    expect(loadLevel(9, 10, t)).toBe("alta");
    expect(loadLevel(12, 10, t)).toBe("sobrecarga");
    expect(loadLevel(0, 0, t)).toBeNull();
  });
});
