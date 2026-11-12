import { describe, it, expect } from "vitest";
import { pickWonStage } from "./won-stage";
const st = [{ name: "Novo Lead" }, { name: "Reagendar Visita" }, { name: "Visita realizada" }, { name: "Matriculado" }];
describe("pickWonStage", () => {
  it("leads vão para Visita realizada", () => expect(pickWonStage(st, "leads")?.name).toBe("Visita realizada"));
  it("visitantes vão para Matriculado", () => expect(pickWonStage(st, "visitors")?.name).toBe("Matriculado"));
  it("visitantes sem Matriculado usam Visita realizada", () => expect(pickWonStage(st.slice(0, 3), "visitors")?.name).toBe("Visita realizada"));
  it("sem etapa de ganho fica onde está", () => expect(pickWonStage(st.slice(0, 2), "leads")).toBeNull());
});
