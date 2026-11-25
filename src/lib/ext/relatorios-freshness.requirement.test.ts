import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, db } = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const db = {
    from: (table: string) => {
      const builder = {
        select: () => builder, in: () => builder, eq: () => builder,
        gte: () => builder, lte: () => builder, order: () => builder,
        range: async (from: number, to: number) => ({ data: (tables[table] ?? []).slice(from, to + 1), error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null }),
      };
      return builder;
    },
  };
  return { tables, db };
});
// The external database cannot run locally; keep the report handler itself real.
vi.mock("./server", () => ({
  extAdmin: () => db,
  getPerms: async () => ({ isAdmin: true, isDirecao: false, managerSchools: [] }),
}));
vi.mock("./auth", () => ({ requireAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain, inputValidator: () => chain,
      handler: (fn: (args: unknown) => unknown) => (args: { data: unknown }) => fn({ ...args, context: { supabase: db, userId: "gestor" } }),
    };
    return chain;
  },
}));
import { attendanceReport } from "./relatorios.functions";

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  tables["schools"] = [{ id: "s1", name: "Centro" }];
  tables["opportunities"] = [{ id: "c1", name: "Contato", school_id: "s1", funnel_id: "f1", status: "open", created_at: "2026-11-01T12:00:00Z", updated_at: "2026-11-10T12:00:00Z", submissions: { updated_at: "2026-11-12T12:00:00Z" } }];
});

describe("Cartões parados há mais de 5 dias ficam em alerta vermelho", () => {
  it("O gestor recebe a data da anotação mais recente no relatório mesmo quando o cartão tem uma data antiga", async () => {
    tables["crm_notes"] = [{ opportunity_id: "c1", created_at: "2026-11-24T12:00:00Z" }];
    const result = await attendanceReport({ data: {} });
    expect(result[0]?.last_updated_at).toBe("2026-11-24T12:00:00Z");
  });
  it("O gestor recebe a data da conclusão da tarefa quando ela é a atualização mais recente", async () => {
    tables["crm_tasks"] = [{ opportunity_id: "c1", done: true, due_date: "2026-11-20", created_at: "2026-11-15T12:00:00Z", done_at: "2026-11-25T12:00:00Z" }];
    const result = await attendanceReport({ data: {} });
    expect(result[0]?.last_updated_at).toBe("2026-11-25T12:00:00Z");
  });
  it("O gestor recebe a data da edição cadastral quando não há anotações ou tarefas mais recentes", async () => {
    const result = await attendanceReport({ data: {} });
    expect(result[0]?.last_updated_at).toBe("2026-11-12T12:00:00Z");
  });
});