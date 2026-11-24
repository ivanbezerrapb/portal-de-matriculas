import { describe, expect, it } from "vitest";
import {
  canAddFreeNote,
  canCreateNewTask,
  needsNextTaskOnComplete,
  pickPrimaryOpenTask,
  validateCompleteTask,
} from "./task-flow";

describe("regras de tarefas e histórico do CRM", () => {
  it("bloqueia histórico avulso quando o cartão ativo tem tarefa pendente", () => {
    const res = canAddFreeNote({ cardStatus: "open", openTaskCount: 1 });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("tarefa pendente");
  });

  it("libera histórico avulso quando não há tarefa pendente ou o cartão está fechado", () => {
    expect(canAddFreeNote({ cardStatus: "open", openTaskCount: 0 }).allowed).toBe(true);
    expect(canAddFreeNote({ cardStatus: "won", openTaskCount: 1 }).allowed).toBe(true);
    expect(canAddFreeNote({ cardStatus: "lost", openTaskCount: 2 }).allowed).toBe(true);
  });

  it("impede criar nova tarefa quando já existe uma pendente no cartão", () => {
    expect(canCreateNewTask({ openTaskCount: 1 }).allowed).toBe(false);
    expect(canCreateNewTask({ openTaskCount: 0 }).allowed).toBe(true);
  });

  it("exige próxima tarefa ao concluir a única tarefa pendente de um cartão ativo", () => {
    expect(needsNextTaskOnComplete({ cardStatus: "open", otherOpenTaskCount: 0 })).toBe(true);

    const semProxima = validateCompleteTask({
      note: "Liguei e o responsável pediu retorno amanhã.",
      cardStatus: "open",
      otherOpenTaskCount: 0,
      nextTask: null,
    });
    expect(semProxima.ok).toBe(false);

    const semData = validateCompleteTask({
      note: "Liguei e ficou de retornar.",
      cardStatus: "open",
      otherOpenTaskCount: 0,
      nextTask: { title: "Ligar novamente", due_date: "" },
    });
    expect(semData.ok).toBe(false);

    const valida = validateCompleteTask({
      note: "Liguei e combinamos retorno.",
      cardStatus: "open",
      otherOpenTaskCount: 0,
      nextTask: { title: "Enviar WhatsApp", due_date: "2026-11-26" },
    });
    expect(valida).toEqual({
      ok: true,
      note: "Liguei e combinamos retorno.",
      nextTask: { title: "Enviar WhatsApp", due_date: "2026-11-26" },
    });
  });

  it("não exige próxima tarefa quando o cartão está fechado ou já tem outra tarefa pendente", () => {
    expect(needsNextTaskOnComplete({ cardStatus: "won", otherOpenTaskCount: 0 })).toBe(false);
    expect(needsNextTaskOnComplete({ cardStatus: "open", otherOpenTaskCount: 1 })).toBe(false);

    const fechado = validateCompleteTask({
      note: "Matrícula confirmada.",
      cardStatus: "won",
      otherOpenTaskCount: 0,
    });
    expect(fechado).toEqual({ ok: true, note: "Matrícula confirmada.", nextTask: null });

    const outraAberta = validateCompleteTask({
      note: "Primeiro contato feito.",
      cardStatus: "open",
      otherOpenTaskCount: 1,
    });
    expect(outraAberta).toEqual({ ok: true, note: "Primeiro contato feito.", nextTask: null });
  });

  it("permite concluir sem próxima tarefa quando o atendente marca skipNext, exigindo histórico", () => {
    const liberada = validateCompleteTask({
      note: "Responsável informou que só decide no próximo mês.",
      cardStatus: "open",
      otherOpenTaskCount: 0,
      nextTask: null,
      skipNext: true,
    });
    expect(liberada).toEqual({
      ok: true,
      note: "Responsável informou que só decide no próximo mês.",
      nextTask: null,
    });

    const semNota = validateCompleteTask({
      note: "   ",
      cardStatus: "open",
      otherOpenTaskCount: 0,
      skipNext: true,
    });
    expect(semNota.ok).toBe(false);
  });

  it("escolhe a tarefa pendente mais urgente como principal", () => {
    const picked = pickPrimaryOpenTask([
      { id: "1", title: "Feita", done: true, due_date: "2026-11-01" },
      { id: "2", title: "Sem data", done: false, due_date: null, created_at: "2026-11-02" },
      { id: "3", title: "Depois", done: false, due_date: "2026-11-28", created_at: "2026-11-01" },
      { id: "4", title: "Mais urgente", done: false, due_date: "2026-11-20", created_at: "2026-11-05" },
    ]);
    expect(picked?.id).toBe("4");
  });
});