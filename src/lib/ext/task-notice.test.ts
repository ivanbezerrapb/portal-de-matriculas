import { describe, expect, it } from "vitest";
import { pendingNoticeItems, todayISO, type NoticeTaskRow } from "./task-notice";

const TODAY = "2026-11-24";
const ME = "u1";

function row(overrides: {
  id: string;
  title?: string;
  done?: boolean;
  due?: string | null;
  cardId?: string;
  cardName?: string;
  status?: string;
  funnelId?: string;
  funnelName?: string;
  schoolName?: string;
  ownerId?: string | null;
  ownerName?: string | null;
}): NoticeTaskRow {
  const ownerId = overrides.ownerId === undefined ? ME : overrides.ownerId;
  return {
    id: overrides.id,
    title: overrides.title ?? "Ligar para o responsável",
    done: overrides.done ?? false,
    due_date: overrides.due === undefined ? TODAY : overrides.due,
    opportunities: {
      id: overrides.cardId ?? `card-${overrides.id}`,
      name: overrides.cardName ?? `0001/CE2027 · Aluno ${overrides.id}`,
      status: overrides.status ?? "open",
      school_id: "school-1",
      funnel_id: overrides.funnelId ?? "funnel-1",
      owner_id: ownerId,
      funnels: { name: overrides.funnelName ?? "Centro - Novo Lead" },
      schools: { name: overrides.schoolName ?? "Centro" },
      owner: ownerId ? { id: ownerId, full_name: overrides.ownerName ?? "Ana" } : null,
    },
  };
}

describe("aviso de cartões com tarefas pendentes", () => {
  it("lista só cartões em aberto do próprio atendente com tarefa atrasada ou do dia", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "a", due: TODAY }),
        row({ id: "b", done: true }),
        row({ id: "c", status: "won" }),
        row({ id: "d", status: "lost" }),
        row({ id: "e", ownerId: "u2", ownerName: "Bruno" }),
        row({ id: "f", ownerId: null, ownerName: null }),
        row({ id: "g", due: "2026-11-25" }),
        row({ id: "h", due: null }),
      ],
      TODAY,
      ME,
    );
    expect(items.map((i) => i.taskId)).toEqual(["a"]);
    expect(items[0]).toMatchObject({
      cardName: "0001/CE2027 · Aluno a",
      funnelName: "Centro - Novo Lead",
      schoolName: "Centro",
      ownerName: "Ana",
      dueDate: TODAY,
      overdue: false,
    });
  });

  it("não mostra nada se não houver atendente informado", () => {
    expect(pendingNoticeItems([row({ id: "a" })], TODAY, "")).toEqual([]);
  });

  it("ignora tarefa sem cartão vinculado", () => {
    const orphan: NoticeTaskRow = { ...row({ id: "x" }), opportunities: null };
    expect(pendingNoticeItems([orphan], TODAY, ME)).toEqual([]);
  });

  it("mantém só atrasadas e do dia, pondo as atrasadas primeiro pela data mais antiga", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "sem-data", due: null, cardName: "1000/CE2027 · Z" }),
        row({ id: "futura", due: "2026-11-30", cardName: "1000/CE2027 · Z" }),
        row({ id: "atrasada-2", due: "2026-11-10", cardName: "1000/CE2027 · Z" }),
        row({ id: "atrasada-1", due: "2026-11-05", cardName: "1000/CE2027 · Z" }),
        row({ id: "hoje", due: TODAY, cardName: "1000/CE2027 · Z" }),
      ],
      TODAY,
      ME,
    );
    expect(items.map((i) => i.taskId)).toEqual([
      "atrasada-1",
      "atrasada-2",
      "hoje",
    ]);
    expect(items[0]?.overdue).toBe(true);
    expect(items[1]?.overdue).toBe(true);
    expect(items[2]?.overdue).toBe(false);
  });

  it("ordena por nome quando a data é a mesma", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "b", cardName: "2000/CE2027 · Bruno", due: TODAY }),
        row({ id: "a", cardName: "1000/CE2027 · Ana", due: TODAY }),
      ],
      TODAY,
      ME,
    );
    expect(items.map((i) => i.cardName)).toEqual([
      "1000/CE2027 · Ana",
      "2000/CE2027 · Bruno",
    ]);
  });

  it("trata a data de hoje como o dia corrente no fuso do portal", () => {
    expect(todayISO(new Date("2026-11-24T02:00:00Z"))).toBe("2026-11-23");
    expect(todayISO(new Date("2026-11-24T12:00:00Z"))).toBe("2026-11-24");
  });
});
