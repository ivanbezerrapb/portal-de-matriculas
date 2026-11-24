export type NextTaskInput = {
  title: string;
  due_date: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Cartões ativos com tarefa pendente não aceitam histórico solto: o atendente deve concluir a tarefa.
export function canAddFreeNote(input: {
  cardStatus: string;
  openTaskCount: number;
}): { allowed: boolean; reason?: string } {
  if (input.cardStatus === "open" && input.openTaskCount > 0) {
    return {
      allowed: false,
      reason: "Há uma tarefa pendente neste cartão. Conclua a tarefa para registrar o histórico.",
    };
  }
  return { allowed: true };
}

// Só pode existir uma tarefa pendente por cartão ao mesmo tempo.
export function canCreateNewTask(input: {
  openTaskCount: number;
}): { allowed: boolean; reason?: string } {
  if (input.openTaskCount > 0) {
    return {
      allowed: false,
      reason:
        "Já existe uma tarefa pendente neste cartão. Conclua a tarefa atual antes de criar outra.",
    };
  }
  return { allowed: true };
}

// Cartão em andamento que ficará sem nenhuma tarefa pendente exige agendar a próxima.
export function needsNextTaskOnComplete(input: {
  cardStatus: string;
  otherOpenTaskCount: number;
}): boolean {
  return input.cardStatus === "open" && input.otherOpenTaskCount === 0;
}

export function validateCompleteTask(input: {
  note: string | undefined;
  cardStatus: string;
  otherOpenTaskCount: number;
  nextTask?: NextTaskInput | null;
}): { ok: true; note: string; nextTask: NextTaskInput | null } | { ok: false; error: string } {
  const note = (input.note ?? "").trim();
  if (!note) {
    return { ok: false, error: "Descreva no histórico o que foi feito para concluir a tarefa." };
  }

  const mustScheduleNext = needsNextTaskOnComplete({
    cardStatus: input.cardStatus,
    otherOpenTaskCount: input.otherOpenTaskCount,
  });

  const rawNext = input.nextTask;
  const hasNext = Boolean(rawNext && (rawNext.title.trim() || rawNext.due_date.trim()));

  if (mustScheduleNext) {
    if (!rawNext || !rawNext.title.trim() || !DATE_RE.test(rawNext.due_date.trim())) {
      return {
        ok: false,
        error: "Todo cartão ativo precisa ter uma próxima tarefa agendada. Selecione a atividade e a data.",
      };
    }
    return {
      ok: true,
      note,
      nextTask: { title: rawNext.title.trim(), due_date: rawNext.due_date.trim() },
    };
  }

  if (hasNext && rawNext) {
    if (input.otherOpenTaskCount > 0) {
      return { ok: false, error: "Este cartão já possui outra tarefa pendente." };
    }
    if (!rawNext.title.trim() || !DATE_RE.test(rawNext.due_date.trim())) {
      return { ok: false, error: "Informe a atividade e uma data válida para a próxima tarefa." };
    }
    return {
      ok: true,
      note,
      nextTask: { title: rawNext.title.trim(), due_date: rawNext.due_date.trim() },
    };
  }

  return { ok: true, note, nextTask: null };
}

// Escolhe a tarefa pendente mais urgente (menor data primeiro; sem data por último; mais antiga antes).
export function pickPrimaryOpenTask<
  T extends { id: string; title: string; done: boolean; due_date: string | null; created_at?: string },
>(tasks: T[]): T | null {
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });
  return open[0] ?? null;
}