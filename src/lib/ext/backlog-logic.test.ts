import { describe, it, expect } from "vitest";
import { groupNotStarted, groupOverdueTasks, sectorOf } from "./backlog-logic";
import type { BacklogCard } from "./backlog-logic";

function card(p: Partial<BacklogCard> & { id: string; school: string }): BacklogCard {
  return {
    funnel_id: "f1",
    stage_id: "s1",
    owner_id: "u1",
    funnel: "Funil",
    listType: "leads",
    ...p,
  };
}

describe("sectorOf", () => {
  it("LEADS é Central de Informações", () => expect(sectorOf("leads")).toBe("Central"));
  it("visitantes é Coordenação", () => expect(sectorOf("visitantes")).toBe("Coordenação"));
});

describe("groupNotStarted", () => {
  it("só conta card parado na 1ª etapa e ordena as unidades", () => {
    const cards = [
      card({ id: "a", school: "Bessa", funnel: "Bessa - Pós Visita" }),
      card({ id: "b", school: "Centro", funnel: "Centro - Novo Lead" }),
      card({ id: "c", school: "Centro", funnel: "Centro - Novo Lead", stage_id: "s2" }),
    ];
    const groups = groupNotStarted(cards, new Map([["f1", "s1"]]));
    expect(groups.map((g) => g.school)).toEqual(["Centro", "Bessa"]);
    expect(groups.find((g) => g.school === "Centro")?.items).toEqual([
      { label: "Centro - Novo Lead", count: 1 },
    ]);
    expect(groups.find((g) => g.school === "Bessa")?.items[0]?.count).toBe(1);
  });
});

describe("groupOverdueTasks", () => {
  const cards = new Map<string, BacklogCard>([
    ["a", card({ id: "a", school: "Cristo", listType: "leads" })],
    ["b", card({ id: "b", school: "Cristo", listType: "visitantes" })],
    ["c", card({ id: "c", school: "Cristo", listType: "visitantes", owner_id: "u2" })],
    ["d", card({ id: "d", school: "Centro", listType: "visitantes", owner_id: null })],
  ]);
  const names = new Map([["u1", "Izabella Paleto"], ["u2", "LAURA MARIA"]]);

  it("separa Central e Coordenação na mesma unidade", () => {
    const groups = groupOverdueTasks(
      cards,
      [
        { opportunity_id: "a" },
        { opportunity_id: "b" },
        { opportunity_id: "b" },
        { opportunity_id: "c" },
      ],
      names,
    );
    expect(groups).toEqual([
      {
        school: "Cristo",
        items: [
          { label: "Izabella Paleto", count: 2, tag: "Coordenação" },
          { label: "Izabella Paleto", count: 1, tag: "Central" },
          { label: "LAURA MARIA", count: 1, tag: "Coordenação" },
        ],
      },
    ]);
  });

  it("mesma pessoa com atrasos nas duas listas vira duas linhas", () => {
    const groups = groupOverdueTasks(
      cards,
      [{ opportunity_id: "a" }, { opportunity_id: "a" }, { opportunity_id: "b" }],
      names,
    );
    const items = groups.find((g) => g.school === "Cristo")?.items ?? [];
    expect(items.find((i) => i.tag === "Central")?.count).toBe(2);
    expect(items.find((i) => i.tag === "Coordenação")?.count).toBe(1);
  });

  it("card sem responsável entra como Sem responsável", () => {
    const groups = groupOverdueTasks(cards, [{ opportunity_id: "d" }], names);
    expect(groups.find((g) => g.school === "Centro")).toEqual({
      school: "Centro",
      items: [{ label: "Sem responsável", count: 1, tag: "Coordenação" }],
    });
  });
});
