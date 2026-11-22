import { describe, expect, it } from "vitest";
import { bearer, findSchool, matchOption, phoneKey, sha256Hex, newKeyValue, KEY_PREFIX } from "./api-logic";

describe("API pública", () => {
  it("lê a chave do cabeçalho Bearer", () => {
    expect(bearer("Bearer abc")).toBe("abc");
    expect(bearer("Basic abc")).toBeNull();
    expect(bearer(null)).toBeNull();
  });
  it("telefone com ou sem 55 e 9 extra é o mesmo lead", () => {
    expect(phoneKey("+55 (83) 99876-5432")).toBe(phoneKey("83 9876-5432"));
  });
  it("série só aceita opção existente do formulário", () => {
    expect(matchOption("1º em", ["1º EF", "1º EM"])).toBe("1º EM");
    expect(matchOption("10º EM", ["1º EM"])).toBeNull();
  });
  it("escola por nome sem acento", () => {
    const s = [{ id: "a", name: "Expedicionários" }, { id: "b", name: "Centro" }];
    expect(findSchool(s, "expedicionarios")?.id).toBe("a");
    expect(findSchool(s, "Recife")).toBeNull();
  });
  it("chave nova tem prefixo e hash estável", async () => {
    const k = newKeyValue();
    expect(k.startsWith(KEY_PREFIX)).toBe(true);
    expect(await sha256Hex(k)).toBe(await sha256Hex(k));
  });
});

import { pageParams, taskState, needsEnrollmentCount, cardName } from "./api-logic";
describe("API v1 — regras novas", () => {
  it("paginação padrão 50, máximo 200", () => {
    expect(pageParams(new URLSearchParams(""))).toEqual({ pagina: 1, limite: 50, from: 0, to: 49 });
    expect(pageParams(new URLSearchParams("pagina=3&limite=500"))).toEqual({ pagina: 3, limite: 200, from: 400, to: 599 });
  });
  it("tarefa vencida antes de hoje é atrasada", () => {
    expect(taskState({ done: false, due_date: "2026-11-21" }, "2026-11-22")).toBe("atrasada");
    expect(taskState({ done: false, due_date: "2026-11-22" }, "2026-11-22")).toBe("pendente");
    expect(taskState({ done: true, due_date: "2026-01-01" }, "2026-11-22")).toBe("concluida");
  });
  it("ganho exige matrículas só em Visitantes", () => {
    expect(needsEnrollmentCount("leads")).toBe(false);
    expect(needsEnrollmentCount("visitantes")).toBe(true);
  });
  it("nome do card mantém o código", () => {
    expect(cardName("1051/CE2027", " Maria ")).toBe("1051/CE2027 · Maria");
  });
});

import { normalizeCampaign as nc } from "./api-logic";
describe("normalizeCampaign", () => {
  it("apara espaços", () => expect(nc("  Black   November ")).toBe("Black November"));
  it("vazio remove a campanha", () => { expect(nc("   ")).toBeNull(); expect(nc(null)).toBeNull(); });
  it("limita a 60 caracteres", () => expect(nc("x".repeat(80))?.length).toBe(60));
});
