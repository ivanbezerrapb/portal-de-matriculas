import { describe, it, expect } from "vitest";
import { groupFunnels } from "./funnel-order";
const f = ["Bessa - Novo Lead", "Cristo - Pós Visita (Fund I)", "Centro - Novo Lead", "Expedicionários - Novo Lead", "Centro - Pós Visita (Infantil)", "Cristo - Novo Lead"].map((name) => ({ name }));
describe("groupFunnels", () => {
  it("agrupa por categoria e ordena Centro, Expedicionários, Cristo, Bessa", () => {
    const g = groupFunnels(f);
    expect(g.map((x) => x.label)).toEqual(["LEADS", "Visitantes (Pós Visita)"]);
    expect(g[0]!.items.map((x) => x.name)).toEqual(["Centro - Novo Lead", "Expedicionários - Novo Lead", "Cristo - Novo Lead", "Bessa - Novo Lead"]);
    expect(g[1]!.items.map((x) => x.name)).toEqual(["Centro - Pós Visita (Infantil)", "Cristo - Pós Visita (Fund I)"]);
  });
});
