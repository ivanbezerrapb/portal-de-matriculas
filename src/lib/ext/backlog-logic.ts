import { compareSchoolNames } from "@/lib/school-order";

// Agrupa os números dos blocos do Início: cards parados na 1ª etapa e
// tarefas atrasadas por responsável (Central de Informações e Coordenação).

export type BacklogGroup = {
  school: string;
  items: { label: string; count: number; tag?: string }[];
};

export type BacklogCard = {
  id: string;
  funnel_id: string;
  stage_id: string;
  owner_id: string | null;
  school: string;
  funnel: string;
  listType: string | null;
};

export type BacklogTask = { opportunity_id: string };

// LEADS é atendido pela Central de Informações; visitantes, pela Coordenação.
export function sectorOf(listType: string | null): string {
  return listType === "leads" ? "Central" : "Coordenação";
}

type Bucket = Map<string, { label: string; count: number; tag?: string }>;

function finish(m: Map<string, Bucket>): BacklogGroup[] {
  return [...m.entries()]
    .map(([school, g]) => ({
      school,
      items: [...g.values()].sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const byLabel = a.label.localeCompare(b.label, "pt-BR");
        if (byLabel !== 0) return byLabel;
        const ta = a.tag ?? "";
        const tb = b.tag ?? "";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return 0;
      }),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => compareSchoolNames(a.school, b.school));
}

// Só conta o card que ainda está na primeira etapa do próprio funil.
export function groupNotStarted(
  cards: BacklogCard[],
  firstStage: Map<string, string>,
): BacklogGroup[] {
  const m = new Map<string, Bucket>();
  for (const c of cards) {
    if (firstStage.get(c.funnel_id) !== c.stage_id) continue;
    const g = m.get(c.school) ?? new Map<string, { label: string; count: number }>();
    const e = g.get(c.funnel) ?? { label: c.funnel, count: 0 };
    e.count += 1;
    g.set(c.funnel, e);
    m.set(c.school, g);
  }
  return finish(m);
}

// Tarefas atrasadas por responsável, separando Central de Informações e
// Coordenação: a mesma pessoa com atrasos nas duas listas aparece em duas linhas.
export function groupOverdueTasks(
  cards: Map<string, BacklogCard>,
  tasks: BacklogTask[],
  ownerNames: Map<string, string>,
): BacklogGroup[] {
  const m = new Map<string, Bucket>();
  for (const t of tasks) {
    const c = cards.get(t.opportunity_id);
    if (!c) continue;
    const label = c.owner_id ? ownerNames.get(c.owner_id) ?? "Sem nome" : "Sem responsável";
    const tag = sectorOf(c.listType);
    const key = `${label}\u0000${tag}`;
    const g = m.get(c.school) ?? new Map<string, { label: string; count: number; tag?: string }>();
    const e = g.get(key) ?? { label, count: 0, tag };
    e.count += 1;
    g.set(key, e);
    m.set(c.school, g);
  }
  return finish(m);
}
