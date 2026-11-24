import { describe, expect, it } from "vitest";
import { canTransferOpportunity, canTransferPortfolio, validatePortfolioTransfer } from "./close-access";

const base = { isAdmin: false, isDirecao: false, managerSchools: [] as string[], infoSchools: [] as string[] };
const opp = { school_id: "s1", funnel_id: "f1", status: "open" };

describe("transferir cartão de funil", () => {
  it("admin transfere para outro funil da mesma escola", () => {
    expect(canTransferOpportunity({ ...base, isAdmin: true }, opp, { id: "f2", school_id: "s1" }, false)).toBeNull();
  });
  it("bloqueia funil de outra escola", () => {
    expect(canTransferOpportunity({ ...base, isAdmin: true }, opp, { id: "f3", school_id: "s2" }, false)).not.toBeNull();
  });
  it("bloqueia cartão fechado", () => {
    expect(canTransferOpportunity({ ...base, isAdmin: true }, { ...opp, status: "won" }, { id: "f2", school_id: "s1" }, false)).not.toBeNull();
  });
  it("Direção não transfere", () => {
    expect(canTransferOpportunity({ ...base, isDirecao: true }, opp, { id: "f2", school_id: "s1" }, true)).not.toBeNull();
  });
  it("Central, Gerente e Coordenação da unidade transferem", () => {
    for (const p of [{ ...base, infoSchools: ["s1"] }, { ...base, managerSchools: ["s1"] }, { ...base, operatorSchools: ["s1"] }])
      expect(canTransferOpportunity(p, opp, { id: "f2", school_id: "s1" }, false)).toBeNull();
  });
  it("Coordenação de outra unidade não transfere", () => {
    expect(canTransferOpportunity({ ...base, operatorSchools: ["s2"] }, opp, { id: "f2", school_id: "s1" }, false)).not.toBeNull();
  });
});

describe("transferir carteira em lote no funil", () => {
  it("permite Admin e Gerente da própria unidade", () => {
    expect(canTransferPortfolio({ ...base, isAdmin: true }, "s1")).toBe(true);
    expect(canTransferPortfolio({ ...base, managerSchools: ["s1"] }, "s1")).toBe(true);
    expect(validatePortfolioTransfer({ ...base, isAdmin: true }, "s1", "u1", "u2")).toBeNull();
    expect(validatePortfolioTransfer({ ...base, managerSchools: ["s1"] }, "s1", null, "u2")).toBeNull();
  });

  it("bloqueia Gerente de outra unidade, Direção, Central e Coordenação", () => {
    expect(canTransferPortfolio({ ...base, managerSchools: ["s2"] }, "s1")).toBe(false);
    expect(canTransferPortfolio({ ...base, isDirecao: true }, "s1")).toBe(false);
    expect(canTransferPortfolio({ ...base, infoSchools: ["s1"] }, "s1")).toBe(false);
    expect(canTransferPortfolio({ ...base, operatorSchools: ["s1"] }, "s1")).toBe(false);
    expect(validatePortfolioTransfer({ ...base, infoSchools: ["s1"] }, "s1", "u1", "u2")).not.toBeNull();
  });

  it("bloqueia transferir para o mesmo atendente ou sem destino", () => {
    expect(validatePortfolioTransfer({ ...base, isAdmin: true }, "s1", "u1", "u1")).not.toBeNull();
    expect(validatePortfolioTransfer({ ...base, isAdmin: true }, "s1", "u1", "")).not.toBeNull();
  });
});
