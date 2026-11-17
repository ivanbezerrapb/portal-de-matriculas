import { describe, it, expect } from "vitest";
import { summarizeVisits } from "./lead-visits-logic";

const now = new Date("2026-11-17T12:00:00Z").getTime();
describe("summarizeVisits", () => {
  it("conta agendadas, realizadas e taxa sobre as vencidas", () => {
    const r = summarizeVisits(
      [
        { school: "Centro", at: "2026-11-10T12:00:00Z", done: true, missed: false },
        { school: "Centro", at: "2026-11-11T12:00:00Z", done: false, missed: true },
        { school: "Centro", at: "2026-11-30T12:00:00Z", done: false, missed: false },
      ],
      now,
    );
    expect(r.total.scheduled).toBe(3);
    expect(r.total.done).toBe(1);
    expect(r.total.rate).toBe(50);
  });
  it("sem visitas vencidas a taxa fica vazia", () => {
    const r = summarizeVisits([{ school: "Bessa", at: "2026-12-01T12:00:00Z", done: false, missed: false }], now);
    expect(r.total.rate).toBeNull();
  });
  it("soma interessados por escola, incluindo quem não tem visita", () => {
    const r = summarizeVisits(
      [{ school: "Centro", at: "2026-11-10T12:00:00Z", done: true, missed: false }],
      now,
      new Map([["Centro", 12], ["Bessa", 5]]),
    );
    expect(r.total.interested).toBe(17);
    expect(r.groups.map((g) => [g.school, g.interested, g.scheduled])).toEqual([
      ["Centro", 12, 1],
      ["Bessa", 5, 0],
    ]);
  });
});
