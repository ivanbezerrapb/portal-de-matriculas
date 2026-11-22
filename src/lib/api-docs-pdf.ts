// Gera a documentação da API em PDF (A4) a partir dos mesmos dados da tela.
import { jsPDF } from "jspdf";
import { API_BASE, ENDPOINTS, ERRORS, GUIA, MODULOS, curl } from "@/lib/api-docs";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 18;

export function apiDocsPdfBlob(): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const para = (text: string, size = 10, bold = false, gap = 1.5) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, CONTENT_W) as string[];
    const lh = size * 0.42;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN, y);
      y += lh;
    }
    y += gap;
  };

  const codeBlock = (code: string) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    const lh = 3.4;
    const wrapped: string[] = [];
    for (const raw of code.split("\n")) {
      const parts = doc.splitTextToSize(raw || " ", CONTENT_W - 6) as string[];
      wrapped.push(...parts);
    }
    for (const line of wrapped) {
      ensure(lh + 1.5);
      doc.setFillColor(243, 244, 246);
      doc.rect(MARGIN, y - 2.6, CONTENT_W, lh + 1.2, "F");
      doc.setTextColor(40, 40, 40);
      doc.text(line, MARGIN + 3, y);
      y += lh;
    }
    y += 3;
  };

  // Capa / introdução
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text("API do Portal de Matrículas", MARGIN, y);
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text("Grupo Intereducacional", MARGIN, y);
  y += 9;

  para(`URL base: ${API_BASE}`, 10, true);
  para(`Versão de ${new Date().toLocaleDateString("pt-BR")} · ${ENDPOINTS.length} funções em ${MODULOS.length} módulos.`, 9);
  y += 2;

  // Sumário
  para("Sumário", 13, true);
  for (const m of MODULOS) {
    para(m.titulo, 10, true, 0.5);
    for (const e of ENDPOINTS.filter((x) => x.modulo === m.id)) para(`   ${e.metodo} ${e.caminho.split("?")[0]} — ${e.titulo}`, 9, false, 0.3);
    y += 1;
  }

  // Guia
  doc.addPage(); y = MARGIN;
  for (const g of GUIA) {
    ensure(14);
    para(g.titulo, 12, true, 1);
    for (const i of g.itens) para(`• ${i}`, 9, false, 0.8);
    y += 2;
  }

  // Endpoints por módulo
  let n = 0;
  for (const m of MODULOS) {
    doc.addPage(); y = MARGIN;
    para(m.titulo, 15, true, 1);
    para(m.descricao, 10, false, 3);
    for (const e of ENDPOINTS.filter((x) => x.modulo === m.id)) {
      n++;
      ensure(24);
      doc.setFillColor(20, 20, 20);
      doc.rect(MARGIN, y - 4.5, CONTENT_W, 7.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(`${n}. ${e.metodo} ${e.caminho.split("?")[0]} — ${e.titulo}`, MARGIN + 2, y);
      y += 6;
      para(e.descricao);
      for (const [label, fs] of [["Parâmetros da URL:", e.query], ["Campos do corpo (JSON):", e.campos]] as const) {
        if (!fs) continue;
        para(label, 9.5, true, 0.5);
        for (const f of fs) para(`• ${f.nome} (${f.tipo}, ${f.obrigatorio ? "obrigatório" : "opcional"}) — ${f.descricao}`, 9, false, 0.8);
        y += 1;
      }
      para("Exemplo (cURL):", 9.5, true, 0.5);
      codeBlock(curl(e));
      para("Resposta:", 9.5, true, 0.5);
      codeBlock(JSON.stringify(e.resposta, null, 2));
      if (e.erros?.length) para(`Erros possíveis: ${e.erros.join(", ")}`, 8.5, false, 1);
      y += 2;
    }
  }

  // Erros
  doc.addPage(); y = MARGIN;
  para("Erros", 13, true);
  for (const [s, c, d] of ERRORS) {
    para(`• HTTP ${s} — ${c}: ${d}`, 9, false, 0.8);
  }

  // Rodapé com numeração
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`API do Portal de Matrículas — Grupo Intereducacional · página ${p} de ${total}`, MARGIN, PAGE_H - 8);
  }

  return doc.output("blob");
}
