// Documentação da API pública (usada na tela e no arquivo para download).
export const API_BASE = "https://painel.grupointereducacional.online/api/public/v1";

export type Field = { nome: string; tipo: string; obrigatorio: boolean; descricao: string };
export type Endpoint = {
  id: string; metodo: "GET" | "POST"; caminho: string; titulo: string; descricao: string;
  campos?: Field[]; query?: Field[]; exemplo?: Record<string, unknown>; resposta: Record<string, unknown>;
};

const ref: Field[] = [
  { nome: "codigo", tipo: "texto", obrigatorio: false, descricao: "Código do lead no portal, ex.: 1051/CE2027. Informe codigo OU telefone." },
  { nome: "telefone", tipo: "texto", obrigatorio: false, descricao: "Telefone com DDD (com ou sem 55, com ou sem máscara)." },
  { nome: "escola", tipo: "texto", obrigatorio: false, descricao: "Limita a busca por telefone a uma escola (nome ou ID)." },
];

export const ENDPOINTS: Endpoint[] = [
  {
    id: "escolas", metodo: "GET", caminho: "/escolas", titulo: "Listar escolas e opções",
    descricao: "Retorna as escolas, as séries e origens aceitas no cadastro de leads, e os funis com suas etapas. Consulte antes de integrar.",
    resposta: { ok: true, escolas: [{ id: "uuid", nome: "Centro", series: ["INF I", "1º EF"], origens: ["WhatsApp", "Site"], funis: [{ id: "uuid", nome: "Centro - LEADS", etapas: [{ id: "uuid", nome: "Novo lead" }] }] }] },
  },
  {
    id: "criar-lead", metodo: "POST", caminho: "/leads", titulo: "Criar lead",
    descricao: "Cadastra o lead na Lista de LEADS da escola, gera o código oficial e cria o card no funil. Se já existir lead com o mesmo telefone na escola, nada é criado e o lead existente é devolvido (criado: false).",
    campos: [
      { nome: "escola", tipo: "texto", obrigatorio: true, descricao: "Nome (Centro, Expedicionários, Cristo, Bessa) ou ID da escola." },
      { nome: "nome", tipo: "texto", obrigatorio: true, descricao: "Nome do responsável/lead." },
      { nome: "telefone", tipo: "texto", obrigatorio: true, descricao: "Telefone com DDD." },
      { nome: "email", tipo: "texto", obrigatorio: false, descricao: "E-mail válido." },
      { nome: "serie", tipo: "texto ou lista", obrigatorio: false, descricao: "Série(s) de interesse, exatamente como em GET /escolas." },
      { nome: "origem", tipo: "texto", obrigatorio: false, descricao: "Origem do contato, como em GET /escolas." },
      { nome: "observacao", tipo: "texto", obrigatorio: false, descricao: "Anotação gravada no histórico do card." },
    ],
    exemplo: { escola: "Centro", nome: "Maria Souza", telefone: "(83) 99876-5432", email: "maria@email.com", serie: ["1º EF"], origem: "Rede social", observacao: "Veio da campanha de novembro" },
    resposta: { ok: true, criado: true, lead: { codigo: "1051/CE2027", card_id: "uuid", escola: "Centro", nome: "Maria Souza", no_funil: true } },
  },
  {
    id: "consultar-lead", metodo: "GET", caminho: "/leads?codigo=1051/CE2027", titulo: "Consultar lead",
    descricao: "Busca um card por código ou telefone e devolve funil, etapa, situação (open, won, lost) e agendamento.",
    query: ref,
    resposta: { ok: true, card: { card_id: "uuid", codigo: "1051/CE2027", nome: "1051/CE2027 · Maria Souza", telefone: "(83) 99876-5432", escola: "Centro", funil: "Centro - LEADS", etapa: "Novo lead", situacao: "open", agendamento: null } },
  },
  {
    id: "agendar", metodo: "POST", caminho: "/agendamentos", titulo: "Agendar visita ou matrícula",
    descricao: "Grava a data no card, move para \"Visita agendada\" (LEADS) ou \"Matrícula agendada\" (Visitantes) e registra no histórico e no Calendário. Chamar de novo reagenda.",
    campos: [
      ...ref,
      { nome: "data_hora", tipo: "data ISO 8601", obrigatorio: true, descricao: "Com fuso, ex.: 2026-12-03T09:00:00-03:00." },
      { nome: "atendente", tipo: "texto", obrigatorio: false, descricao: "Nome de quem agendou (aparece em \"Agendado por\")." },
      { nome: "observacao", tipo: "texto", obrigatorio: false, descricao: "Complemento da anotação." },
    ],
    exemplo: { codigo: "1051/CE2027", data_hora: "2026-12-03T09:00:00-03:00", atendente: "Ana Luiza" },
    resposta: { ok: true, tipo: "visita", card: { codigo: "1051/CE2027", etapa: "Visita agendada", agendamento: "2026-12-03T12:00:00+00:00" } },
  },
  {
    id: "etapa", metodo: "POST", caminho: "/etapa", titulo: "Mover etapa",
    descricao: "Move o card para outra etapa do mesmo funil (nome ou ID da etapa). Ganho e perda continuam sendo feitos dentro do portal.",
    campos: [...ref, { nome: "etapa", tipo: "texto", obrigatorio: true, descricao: "Nome ou ID da etapa, como em GET /escolas." }],
    exemplo: { codigo: "1051/CE2027", etapa: "Em atendimento" },
    resposta: { ok: true, card: { codigo: "1051/CE2027", etapa: "Em atendimento" } },
  },
  {
    id: "notas", metodo: "POST", caminho: "/notas", titulo: "Adicionar anotação",
    descricao: "Grava uma anotação no histórico do card.",
    campos: [...ref, { nome: "texto", tipo: "texto", obrigatorio: true, descricao: "Conteúdo da anotação." }, { nome: "autor", tipo: "texto", obrigatorio: false, descricao: "Nome exibido como autor." }],
    exemplo: { telefone: "83998765432", escola: "Centro", texto: "Cliente pediu retorno à tarde." },
    resposta: { ok: true, card: { codigo: "1051/CE2027" } },
  },
];

export const ERRORS: [number, string, string][] = [
  [400, "json_invalido", "O corpo não é um JSON válido."],
  [401, "nao_autorizado", "Chave ausente, inválida ou revogada."],
  [404, "card_nao_encontrado", "Nenhum card com o código/telefone informado."],
  [409, "card_fechado", "O card já foi ganho ou perdido."],
  [422, "dados_invalidos / escola_invalida / serie_invalida / origem_invalida / etapa_invalida", "Algum campo está errado; a mensagem explica qual."],
  [500, "erro_interno", "Falha inesperada; tente novamente."],
];

export function curl(e: Endpoint, key = "SUA_CHAVE") {
  const url = `${API_BASE}${e.caminho}`;
  if (e.metodo === "GET") return `curl "${url}" \\\n  -H "Authorization: Bearer ${key}"`;
  return `curl -X POST "${url}" \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.exemplo ?? {})}'`;
}

export function jsCode(e: Endpoint) {
  const url = `${API_BASE}${e.caminho}`;
  return e.metodo === "GET"
    ? `const r = await fetch("${url}", {\n  headers: { Authorization: "Bearer " + process.env.PORTAL_API_KEY },\n});\nconsole.log(await r.json());`
    : `const r = await fetch("${url}", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer " + process.env.PORTAL_API_KEY,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${JSON.stringify(e.exemplo ?? {}, null, 2).replace(/\n/g, "\n  ")}),\n});\nconsole.log(await r.json());`;
}

export function pyCode(e: Endpoint) {
  const url = `${API_BASE}${e.caminho}`;
  return e.metodo === "GET"
    ? `import os, requests\nr = requests.get("${url}",\n    headers={"Authorization": "Bearer " + os.environ["PORTAL_API_KEY"]})\nprint(r.json())`
    : `import os, requests\nr = requests.post("${url}",\n    headers={"Authorization": "Bearer " + os.environ["PORTAL_API_KEY"]},\n    json=${JSON.stringify(e.exemplo ?? {}, null, 4).replace(/\n/g, "\n    ")})\nprint(r.json())`;
}

export function markdownDoc() {
  const out: string[] = [
    "# API do Portal de Matrículas — Grupo Intereducacional", "",
    `URL base: \`${API_BASE}\``, "",
    "## Autenticação", "",
    "Todas as chamadas exigem o cabeçalho `Authorization: Bearer <chave>`. A chave é gerada pelo administrador em Configurações › API. Corpo e respostas em JSON (UTF-8). Datas em ISO 8601 com fuso.", "",
    "Toda resposta tem `ok` (true/false). Em erro: `{ \"ok\": false, \"erro\": \"codigo\", \"mensagem\": \"texto\" }`.", "",
  ];
  for (const e of ENDPOINTS) {
    out.push(`## ${e.titulo}`, "", `\`${e.metodo} ${e.caminho}\``, "", e.descricao, "");
    const fs = e.campos ?? e.query;
    if (fs) {
      out.push(e.campos ? "Campos do corpo:" : "Parâmetros da URL:", "", "| Campo | Tipo | Obrigatório | Descrição |", "|---|---|---|---|");
      for (const f of fs) out.push(`| ${f.nome} | ${f.tipo} | ${f.obrigatorio ? "sim" : "não"} | ${f.descricao} |`);
      out.push("");
    }
    out.push("Exemplo:", "", "```bash", curl(e), "```", "", "Resposta:", "", "```json", JSON.stringify(e.resposta, null, 2), "```", "");
  }
  out.push("## Erros", "", "| HTTP | erro | Significado |", "|---|---|---|");
  for (const [s, c, d] of ERRORS) out.push(`| ${s} | ${c} | ${d} |`);
  return out.join("\n");
}
