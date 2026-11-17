import { compareSchoolNames } from "../school-order";

export type VisitRec = { school: string; at: string; done: boolean; missed: boolean };
export type VisitGroup = {
  school: string;
  interested: number;
  scheduled: number;
  done: number;
  due: number;
  rate: number | null;
};

const blank = (school: string): VisitGroup => ({
  school,
  interested: 0,
  scheduled: 0,
  done: 0,
  due: 0,
  rate: null,
});

// Interessados = total de leads; agendadas = todas as visitas; realizadas = check-in;
// taxa = realizadas ÷ visitas com data já passada.
export function summarizeVisits(
  recs: VisitRec[],
  now: number,
  interested: Map<string, number> = new Map(),
): { groups: VisitGroup[]; total: VisitGroup } {
  const map = new Map<string, VisitGroup>();
  const get = (school: string) => {
    const g = map.get(school) ?? blank(school);
    map.set(school, g);
    return g;
  };
  const total: VisitGroup = blank("Total");
  for (const [school, n] of interested) {
    get(school).interested += n;
    total.interested += n;
  }
  for (const r of recs) {
    const g = get(r.school);
    const due = r.done || r.missed || new Date(r.at).getTime() < now;
    for (const t of [g, total]) {
      t.scheduled++;
      if (r.done) t.done++;
      if (due) t.due++;
    }
  }
  const fin = (g: VisitGroup) => ({ ...g, rate: g.due ? Math.round((g.done / g.due) * 100) : null });
  return {
    groups: [...map.values()].map(fin).sort((a, b) => compareSchoolNames(a.school, b.school)),
    total: fin(total),
  };
}
