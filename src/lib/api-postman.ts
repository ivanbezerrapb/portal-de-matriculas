// Coleção Postman (v2.1) gerada a partir da documentação da API.
import { API_BASE, ENDPOINTS, MODULOS, type Endpoint, type Field } from "@/lib/api-docs";

const exampleFor = (q: Field) => {
  const n = q.nome;
  if (n === "pagina") return "1";
  if (n === "limite") return "50";
  if (n === "escola") return "Centro";
  if (n === "codigo") return "1051/CE2027";
  if (n === "de") return "2026-12-01";
  if (n === "ate") return "2026-12-31";
  return "";
};

function item(e: Endpoint) {
  const path = e.caminho.replace("{id}", ":id").replace(/^\//, "").split("/");
  const query = (e.query ?? []).map((q) => ({ key: q.nome, value: exampleFor(q), description: `${q.obrigatorio ? "(obrigatório) " : ""}${q.descricao}`, disabled: !q.obrigatorio }));
  const variable = e.caminho.includes("{id}") ? [{ key: "id", value: "ID_DA_TAREFA", description: "ID da tarefa" }] : undefined;
  const campos = (e.campos ?? []).map((c) => `- \`${c.nome}\` (${c.tipo}${c.obrigatorio ? ", obrigatório" : ""}): ${c.descricao}`).join("\n");
  const body = e.metodo !== "GET" && e.exemplo
    ? { mode: "raw", raw: JSON.stringify(e.exemplo, null, 2), options: { raw: { language: "json" } } } : undefined;
  return {
    name: `${e.metodo} ${e.caminho} — ${e.titulo}`,
    request: {
      method: e.metodo,
      header: body ? [{ key: "Content-Type", value: "application/json" }] : [],
      url: { raw: `{{base_url}}/${path.join("/")}`, host: ["{{base_url}}"], path, ...(query.length ? { query } : {}), ...(variable ? { variable } : {}) },
      ...(body ? { body } : {}),
      description: e.descricao + (campos ? `\n\n**Campos:**\n${campos}` : ""),
    },
    response: [],
  };
}

export function postmanCollection(apiKey = "") {
  return {
    info: {
      name: "API Portal de Matrículas — Grupo Intereducacional",
      description: "Coleção pronta. Preencha a variável api_key com sua chave (Configurações › API).",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{api_key}}", type: "string" }] },
    variable: [
      { key: "base_url", value: API_BASE, type: "string" },
      { key: "api_key", value: apiKey || "COLE_SUA_CHAVE_AQUI", type: "string" },
    ],
    item: MODULOS.map((m) => ({ name: m.titulo, description: m.descricao, item: ENDPOINTS.filter((e) => e.modulo === m.id).map(item) })),
  };
}
