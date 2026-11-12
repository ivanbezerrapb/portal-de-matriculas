import { compareSchoolNames } from "./school-order";
import { funnelListType } from "./ext/model";

// Funis ordenados: LEADS antes de Visitantes; escolas Centro, Expedicionários, Cristo, Bessa; depois alfabético.
export function sortFunnels<T extends { name: string }>(funnels: T[]): T[] {
  const rank = (f: T) => (funnelListType(f.name) === "leads" ? 0 : 1);
  return [...funnels].sort((a, b) => rank(a) - rank(b) || compareSchoolNames(a.name, b.name));
}

export function groupFunnels<T extends { name: string }>(funnels: T[]) {
  const sorted = sortFunnels(funnels);
  return [
    { label: "LEADS", items: sorted.filter((f) => funnelListType(f.name) === "leads") },
    { label: "Visitantes (Pós Visita)", items: sorted.filter((f) => funnelListType(f.name) !== "leads") },
  ].filter((g) => g.items.length > 0);
}
