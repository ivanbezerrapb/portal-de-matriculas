// @vitest-environment jsdom
import React, { type ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { writeFileSync } from "node:fs";

const { report } = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("@/lib/ext/relatorios.functions", () => ({
  attendanceReport: report,
  reportOptions: async () => ({ schools: [{ id: "s1", name: "Centro" }], funnels: [] }),
}));
vi.mock("@/lib/ext/cadastros.functions", () => ({ getMyPermissions: async () => ({ fullName: "Gestor" }) }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => ({ options }) }));
import { Route } from "./relatorios.atendimento";

const NOW = Date.parse("2026-11-25T18:00:00Z");
const DAY = 86_400_000;
const Page = Route.options.component as ComponentType;
const row = (id: string, days: number, status: "open" | "won" | "lost" = "open", attendant = "Atendente A") => ({
  id, client: id, school: "Centro", funnel_id: "f1", funnel: "Centro - LEADS", stage: "Em contato",
  owner_id: "u1", attendant, status, restricted: false, overdue: 0,
  created_at: "2026-01-01T12:00:00Z", last_updated_at: new Date(NOW - days * DAY).toISOString(),
});
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  report.mockResolvedValue([row("Recente", 3), row("Atenção", 7), row("Parado", 8), row("Ganho antigo", 20, "won"), row("Perdido antigo", 20, "lost")]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function openReport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  await screen.findByText("Parado");
}

describe("O nome do documento segue o título do relatório", () => {
  it("O gestor imprime Atendimento do Centro com o nome Relatório de Atendimento — Centro", async () => {
    await openReport();
    let printedTitle = "";
    vi.spyOn(window, "print").mockImplementation(() => {
      window.dispatchEvent(new Event("beforeprint"));
      printedTitle = document.title;
      window.dispatchEvent(new Event("afterprint"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    await vi.waitFor(() => expect(printedTitle).toBe("Relatório de Atendimento — Centro"));
  });
  it("O gestor fecha a impressão e o nome original da tela é restaurado", async () => {
    document.title = "Atendimento — Portal";
    await openReport();
    let printedTitle = "";
    vi.spyOn(window, "print").mockImplementation(() => {
      window.dispatchEvent(new Event("beforeprint"));
      printedTitle = document.title;
    });
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    await vi.waitFor(() => expect(printedTitle).toBe("Relatório de Atendimento — Centro"));
    window.dispatchEvent(new Event("afterprint"));
    expect(document.title).toBe("Atendimento — Portal");
  });
});

describe("Os indicadores de atualização consideram apenas cartões em aberto", () => {
  it("O gestor imprime os indicadores com os mesmos totais, percentuais e média exibidos na tela", async () => {
    await openReport();
    vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    const output = document.getElementById("list-report");
    if (!output) throw new Error("Relatório de impressão não encontrado");
    expect(output).toHaveTextContent("Em dia");
    expect(output).toHaveTextContent("Em atenção");
    expect(output).toHaveTextContent("Críticos / Parados");
    expect(output.textContent?.match(/33,3%/g)).toHaveLength(3);
    expect(output).toHaveTextContent(/Média sem atualização:?\s*6 dias/);
    const qaPath = process.env["ATTENDANCE_PRINT_QA"];
    if (qaPath) writeFileSync(qaPath, output.outerHTML);
  });
  it("O gestor vê um cartão em dia, um em atenção e um crítico, sem contar ganhos e perdas", async () => {
    await openReport();
    for (const label of [/Em dia/, /Em atenção/, /Críticos/]) {
      const metric = screen.getByRole("button", { name: label });
      expect(within(metric).getByText("1")).toBeInTheDocument();
      expect(within(metric).getByText("33,3%")).toBeInTheDocument();
    }
  });
  it("O gestor vê a média de seis dias calculada somente sobre os cartões em aberto", async () => {
    await openReport();
    expect(within(screen.getByTestId("average-update")).getByText("6 dias")).toBeInTheDocument();
  });
  it("O gestor vê indicadores zerados quando não existem cartões em aberto", async () => {
    report.mockResolvedValue([row("Ganho antigo", 20, "won")]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
    await screen.findByRole("table", { name: "Totais por atendente" });
    expect(within(screen.getByRole("button", { name: /Críticos/ })).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("average-update")).getByText("—")).toBeInTheDocument();
  });
});

describe("A lista de cartões do Atendimento mostra apenas cartões em aberto", () => {
  it("O gestor vê na lista apenas os cartões em aberto, sem exibir ganhos nem perdidos", async () => {
    await openReport();
    const table = screen.getByRole("table", { name: "Cartões" });
    expect(within(table).getByText("Recente")).toBeInTheDocument();
    expect(within(table).getByText("Atenção")).toBeInTheDocument();
    expect(within(table).getByText("Parado")).toBeInTheDocument();
    expect(within(table).queryByText("Ganho antigo")).not.toBeInTheDocument();
    expect(within(table).queryByText("Perdido antigo")).not.toBeInTheDocument();
    const totalsTable = screen.getByRole("table", { name: "Totais por atendente" });
    const rowCells = within(totalsTable).getByText("Atendente A").closest("tr")?.querySelectorAll("td");
    expect(Array.from(rowCells ?? []).map((td) => td.textContent)).toEqual(["Atendente A", "5", "3", "1", "1", "0", "0", "1"]);
  });
  it("O gestor imprime o relatório e a lista impressa também traz apenas cartões em aberto", async () => {
    await openReport();
    vi.spyOn(window, "print").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    const output = document.getElementById("list-report");
    if (!output) throw new Error("Relatório de impressão não encontrado");
    expect(output).toHaveTextContent("Recente");
    expect(output).toHaveTextContent("Atenção");
    expect(output).toHaveTextContent("Parado");
    expect(output).not.toHaveTextContent("Ganho antigo");
    expect(output).not.toHaveTextContent("Perdido antigo");
  });
});

describe("Os indicadores de situação filtram a lista de cartões do Atendimento", () => {
  it("O gestor seleciona Críticos e vê apenas o cartão aberto parado há oito dias", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: /Críticos/ }));
    expect(screen.getByText("Parado")).toBeInTheDocument();
    expect(screen.queryByText("Recente")).not.toBeInTheDocument();
    expect(screen.queryByText("Ganho antigo")).not.toBeInTheDocument();
    expect(screen.queryByText("Perdido antigo")).not.toBeInTheDocument();
  });
  it("O gestor seleciona Em atenção e vê apenas o cartão aberto sem atualização há sete dias", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: /Em atenção/ }));
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.queryByText("Parado")).not.toBeInTheDocument();
    expect(screen.queryByText("Recente")).not.toBeInTheDocument();
  });
  it("O gestor seleciona Em dia e vê apenas o cartão atualizado há três dias", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: /Em dia/ }));
    expect(screen.getByText("Recente")).toBeInTheDocument();
    expect(screen.queryByText("Atenção")).not.toBeInTheDocument();
    expect(screen.queryByText("Parado")).not.toBeInTheDocument();
  });
  it("O gestor clica novamente no indicador selecionado e volta a ver todos os cartões em aberto", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: /Críticos/ }));
    fireEvent.click(screen.getByRole("button", { name: /Críticos/ }));
    expect(screen.getByText("Recente")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.queryByText("Ganho antigo")).not.toBeInTheDocument();
  });
});

describe("Cartões parados a partir de 8 dias ficam em alerta vermelho", () => {
  it.each([
    [3, /Em dia/],
    [4, /Em atenção/],
    [7, /Em atenção/],
    [8, /Críticos/],
  ])("O gestor filtra um cartão sem atualização há %i dias pela situação correspondente", async (days, label) => {
    report.mockResolvedValue([row("Parado", days)]);
    await openReport();
    const metric = screen.getByRole("button", { name: label });
    expect(within(metric).getByText("1")).toBeInTheDocument();
    fireEvent.click(metric);
    expect(within(screen.getByRole("table", { name: "Cartões" })).getByText("Parado")).toBeInTheDocument();
  });
  it("O gestor vê o tempo da atualização mais recente no relatório, não a data de criação", async () => {
    await openReport();
    const card = screen.getByText("Parado").closest("tr");
    if (!card) throw new Error("Cartão não encontrado");
    expect(within(card).getByText("Sem atualização há 8 dias")).toBeInTheDocument();
  });
  it("O gestor vê um cartão parado para o atendente, sem contar os cartões encerrados antigos", async () => {
    await openReport();
    const table = screen.getByRole("table", { name: "Totais por atendente" });
    expect(within(table).getByRole("columnheader", { name: "Parados (8 dias ou mais)" })).toBeInTheDocument();
    const total = within(table).getByText("Atendente A").closest("tr");
    if (!total) throw new Error("Atendente não encontrado");
    expect(total.lastElementChild).toHaveTextContent("1");
  });
  it("O gestor ordena os cartões da atualização mais antiga para a mais recente", async () => {
    await openReport();
    fireEvent.click(screen.getByRole("button", { name: /Última atualização/ }));
    const table = screen.getByRole("table", { name: "Cartões" });
    const clients = within(table).getAllByRole("row").slice(1).map((tr) => tr.firstElementChild?.textContent);
    expect(clients).toEqual(["Parado", "Atenção", "Recente"]);
  });
});
