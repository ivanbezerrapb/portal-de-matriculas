// Regras puras do aviso de cartões com tarefas pendentes (sem banco, testável).

export type NoticeTaskRow = {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  opportunities: {
    id: string;
    name: string;
    status: string;
    school_id: string;
    funnel_id: string;
    owner_id?: string | null;
    funnels: { name: string } | null;
    schools: { name: string } | null;
    owner: { id: string; full_name: string | null } | null;
  } | null;
};

export type NoticeItem = {
  taskId: string;
  cardId: string;
  cardName: string;
  funnelId: string;
  funnelName: string;
  schoolName: string;
  taskTitle: string;
  dueDate: string;
  overdue: boolean;
  ownerName: string | null;
};

// Data de hoje no fuso do portal (America/Fortaleza), no formato AAAA-MM-DD.
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(now);
}

/**
 * Cartões em aberto do próprio atendente com tarefa atrasada ou para hoje.
 * Ignora tarefas futuras (a vencer) e sem data.
 * Atrasadas primeiro (mais antigas antes), depois as do dia, por nome.
 */
export function pendingNoticeItems(
  tasks: NoticeTaskRow[],
  today: string,
  ownerId: string,
): NoticeItem[] {
  if (!ownerId) return [];
  const items: NoticeItem[] = [];
  for (const t of tasks) {
    if (t.done) continue;
    if (!t.due_date || t.due_date > today) continue;
    const opp = t.opportunities;
    if (!opp || opp.status !== "open") continue;
    const cardOwnerId = opp.owner?.id ?? opp.owner_id ?? null;
    if (cardOwnerId !== ownerId) continue;
    items.push({
      taskId: t.id,
      cardId: opp.id,
      cardName: opp.name,
      funnelId: opp.funnel_id,
      funnelName: opp.funnels?.name ?? "",
      schoolName: opp.schools?.name ?? "",
      taskTitle: t.title,
      dueDate: t.due_date,
      overdue: t.due_date < today,
      ownerName: opp.owner?.full_name?.trim() || null,
    });
  }
  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.cardName.localeCompare(b.cardName);
  });
  return items;
}
