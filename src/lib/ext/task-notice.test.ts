import { describe, expect, it } from "vitest";
import { pendingNoticeItems, todayISO, type NoticeTaskRow } from "./task-notice";

const TODAY = "2026-11-24";

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
  ownerName?: string | null;
}): NoticeTaskRow {
  return {
    id: overrides.id,
    title: overrides.title ?? "Ligar para o responsável",
    done: overrides.done ?? false,
    due_date: overrides.due === undefined ? null : overrides.due,
    opportunities: {
      id: overrides.cardId ?? `card-${overrides.id}`,
      name: overrides.cardName ?? `0001/CE2027 · Aluno ${overrides.id}`,
      status: overrides.status ?? "open",
      school_id: "school-1",
      funnel_id: overrides.funnelId ?? "funnel-1",
      funnels: { name: overrides.funnelName ?? "Centro - Novo Lead" },
      schools: { name: overrides.schoolName ?? "Centro" },
      owner: { id: "u1", full_name: overrides.ownerName ?? "Ana" },
    },
  };
}

describe("aviso de cartões com tarefas pendentes", () => {
  it("lista só cartões em aberto que têm tarefa pendente", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "a" }),
        row({ id: "b", done: true }),
        row({ id: "c", status: "won" }),
        row({ id: "d", status: "lost" }),
      ],
      TODAY,
    );
    expect(items.map((i) => i.taskId)).toEqual(["a"]);
    expect(items[0]).toMatchObject({
      cardName: "0001/CE2027 · Aluno a",
      funnelName: "Centro - Novo Lead",
      schoolName: "Centro",
      ownerName: "Ana",
      overdue: false,
    });
  });

  it("ignora tarefa sem cartão vinculado", () => {
    const orphan: NoticeTaskRow = { ...row({ id: "x" }), opportunities: null };
    expect(pendingNoticeItems([orphan], TODAY)).toEqual([]);
  });

  it("põe as atrasadas primeiro, depois pela data e as sem data por último", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "sem-data", cardName: "1000/CE2027 · Z" }),
        row({ id: "futura", due: "2026-11-30", cardName: "1000/CE2027 · Z" }),
        row({ id: "atrasada-2", due: "2026-11-10", cardName: "1000/CE2027 · Z" }),
        row({ id: "atrasada-1", due: "2026-11-05", cardName: "1000/CE2027 · Z" }),
        row({ id: "hoje", due: TODAY, cardName: "1000/CE2027 · Z" }),
      ],
      TODAY,
    );
    expect(items.map((i) => i.taskId)).toEqual([
      "atrasada-1",
      "atrasada-2",
      "hoje",
      "futura",
      "sem-data",
    ]);
    expect(items[0]?.overdue).toBe(true);
    expect(items[2]?.overdue).toBe(false);
    expect(items[4]?.overdue).toBe(false);
  });

  it("ordena por nome quando a data é a mesma", () => {
    const items = pendingNoticeItems(
      [
        row({ id: "b", cardName: "2000/CE2027 · Bruno", due: "2026-11-25" }),
        row({ id: "a", cardName: "1000/CE2027 · Ana", due: "2026-11-25" }),
      ],
      TODAY,
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
