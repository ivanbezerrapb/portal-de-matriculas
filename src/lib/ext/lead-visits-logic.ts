import { compareSchoolNames } from "../school-order";

export type VisitRec = { school: string; at: string; done: boolean; missed: boolean };
export type VisitGroup = { school: string; scheduled: number; done: number; due: number; rate: number | null };

// Agendadas = todas; realizadas = check-in; taxa = realizadas ÷ visitas com data já passada.
export function summarizeVisits(recs: VisitRec[], now: number): { groups: VisitGroup[]; total: VisitGroup } {
  const map = new Map<string, VisitGroup>();
  const total: VisitGroup = { school: "Total", scheduled: 0, done: 0, due: 0, rate: null };
  for (const r of recs) {
    const g = map.get(r.school) ?? { school: r.school, scheduled: 0, done: 0, due: 0, rate: null };
    const due = r.done || r.missed || new Date(r.at).getTime() < now;
    for (const t of [g, total]) {
      t.scheduled++;
      if (r.done) t.done++;
      if (due) t.due++;
    }
    map.set(r.school, g);
  }
  const fin = (g: VisitGroup) => ({ ...g, rate: g.due ? Math.round((g.done / g.due) * 100) : null });
  return {
    groups: [...map.values()].map(fin).sort((a, b) => compareSchoolNames(a.school, b.school)),
    total: fin(total),
  };
}
