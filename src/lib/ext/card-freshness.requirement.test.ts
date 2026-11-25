import { describe, expect, it } from "vitest";
import { describeCardFreshness, resolveLastUpdatedAt } from "./card-freshness";

const NOW = Date.parse("2026-11-25T18:00:00Z");
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("Cartões parados a partir de 8 dias ficam em alerta vermelho", () => {
  it("Mostra atualização recente em tom positivo quando o cartão foi atualizado há até 3 dias", () => {
    const agora = describeCardFreshness(new Date(NOW - 20_000).toISOString(), { now: NOW, status: "open" });
    expect(agora?.level).toBe("fresh");
    expect(agora?.label).toBe("Atualizado agora");

    const horas = describeCardFreshness(new Date(NOW - 4 * HOUR).toISOString(), { now: NOW, status: "open" });
    expect(horas?.level).toBe("fresh");
    expect(horas?.label).toBe("Atualizado há 4h");

    const doisDias = describeCardFreshness(new Date(NOW - 3 * DAY).toISOString(), { now: NOW, status: "open" });
    expect(doisDias?.level).toBe("fresh");
    expect(doisDias?.label).toBe("Atualizado há 3 dias");
  });

  it("Mostra destaque de atenção entre 4 e 7 dias sem atualização", () => {
    const tresDias = describeCardFreshness(new Date(NOW - 4 * DAY).toISOString(), { now: NOW, status: "open" });
    expect(tresDias?.level).toBe("warning");
    expect(tresDias?.label).toBe("Atualizado há 4 dias");

    const cincoDias = describeCardFreshness(new Date(NOW - 7 * DAY).toISOString(), { now: NOW, status: "open" });
    expect(cincoDias?.level).toBe("warning");
    expect(cincoDias?.label).toBe("Atualizado há 7 dias");
  });

  it("Destaca em alerta vermelho quando o cartão em aberto chega a 8 dias sem atualização", () => {
    const seisDias = describeCardFreshness(new Date(NOW - 8 * DAY).toISOString(), { now: NOW, status: "open" });
    expect(seisDias?.level).toBe("stale");
    expect(seisDias?.label).toBe("Sem atualização há 8 dias");
    expect(seisDias?.title).toContain("17/11/2026");

    const dozeDias = describeCardFreshness(new Date(NOW - 12 * DAY).toISOString(), { now: NOW, status: "open" });
    expect(dozeDias?.level).toBe("stale");
    expect(dozeDias?.label).toBe("Sem atualização há 12 dias");
  });

  it("Não dispara alerta vermelho para cartões já encerrados como ganho ou perdido", () => {
    const ganho = describeCardFreshness(new Date(NOW - 20 * DAY).toISOString(), { now: NOW, status: "won" });
    expect(ganho?.level).toBe("neutral");
    expect(ganho?.label).toBe("Atualizado há 20 dias");

    const perdido = describeCardFreshness(new Date(NOW - 10 * DAY).toISOString(), { now: NOW, status: "lost" });
    expect(perdido?.level).toBe("neutral");
    expect(perdido?.label).toBe("Atualizado há 10 dias");
  });

  it("Considera a interação mais recente entre cartão, cadastro, anotações e tarefas", () => {
    const latest = resolveLastUpdatedAt([
      "2026-11-10T10:00:00Z",
      "2026-11-18T12:00:00+00:00",
      null,
      "2026-11-24T15:30:00Z",
      undefined,
    ]);
    expect(latest).toBe("2026-11-24T15:30:00Z");
  });
});