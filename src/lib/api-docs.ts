// Documentação da API pública (usada na tela, no arquivo .md e no PDF).
export const API_BASE = "https://painel.grupointereducacional.online/api/public/v1";

export type Field = { nome: string; tipo: string; obrigatorio: boolean; descricao: string };
export type Metodo = "GET" | "POST" | "PATCH" | "DELETE";
export type Modulo = "apoio" | "leads" | "calendario" | "pipeline" | "tarefas";
export type Endpoint = {
  id: string; modulo: Modulo; metodo: Metodo; caminho: string; titulo: string; descricao: string;
  campos?: Field[]; query?: Field[]; exemplo?: Record<string, unknown>; resposta: Record<string, unknown>;
  erros?: string[];
};

export const MODULOS: { id: Modulo; titulo: string; descricao: string }[] = [
  { id: "apoio", titulo: "Apoio (consultas de referência)", descricao: "Escolas, séries, origens, usuários e motivos. Consulte antes de integrar para usar os valores exatos." },
  { id: "leads", titulo: "Leads", descricao: "Consulta, criação, edição e histórico de leads (cards da Lista de LEADS)." },
  { id: "calendario", titulo: "Calendário", descricao: "Agendamentos de visitas (LEADS) e matrículas (Visitantes): consulta, criação, reagendamento, cancelamento, check-in e falta." },
  { id: "pipeline", titulo: "Pipeline", descricao: "Funis, etapas e cards: listar, mover, transferir, trocar responsável e fechar como ganho ou perda." },
  { id: "tarefas", titulo: "Tarefas", descricao: "Tarefas dos cards: listar, criar, editar, concluir, reabrir e excluir." },
];

const f = (nome: string, tipo: string, obrigatorio: boolean, descricao: string): Field => ({ nome, tipo, obrigatorio, descricao });

const ref: Field[] = [
  f("card_id", "uuid", false, "ID do card (devolvido em todas as respostas). Informe card_id, codigo OU telefone."),
  f("codigo", "texto", false, "Código do lead no portal, ex.: 1051/CE2027."),
  f("telefone", "texto", false, "Telefone com DDD (com ou sem 55, com ou sem máscara)."),
  f("escola", "texto", false, "Limita a busca por telefone a uma escola (nome ou ID)."),
];
const pag: Field[] = [
  f("pagina", "número", false, "Página (começa em 1). Padrão 1."),
  f("limite", "número", false, "Itens por página, 1 a 200. Padrão 50."),
];
const lista = (item: Record<string, unknown>) => ({ ok: true, pagina: 1, limite: 50, total: 1, itens: [item] });

const cardEx = {
  card_id: "uuid", codigo: "1051/CE2027", nome: "1051/CE2027 · Maria Souza", telefone: "(83) 99876-5432", email: "maria@email.com",
  tipo: "leads", escola: "Centro", funil: "Centro - LEADS", funil_id: "uuid", etapa: "Visita agendada", etapa_id: "uuid",
  situacao: "open", agendamento: "2026-12-03T12:00:00+00:00", responsavel: { id: "uuid", nome: "Ana Luiza" },
  cadastrado_em: "2026-11-20T14:02:00+00:00", atualizado_em: "2026-11-21T10:00:00+00:00",
};
const cardMini = { card_id: "uuid", codigo: "1051/CE2027", nome: "1051/CE2027 · Maria Souza", telefone: "(83) 99876-5432", escola: "Centro", funil: "Centro - LEADS", etapa: "Visita agendada", situacao: "open", agendamento: "2026-12-03T12:00:00+00:00" };
const taskEx = { id: "uuid", titulo: "Ligar para confirmar visita", vencimento: "2026-12-02", situacao: "pendente", concluida_em: null, criada_em: "2026-11-22T12:00:00+00:00", card: { card_id: "uuid", codigo: "1051/CE2027", nome: "1051/CE2027 · Maria Souza", escola: "Centro", funil: "Centro - LEADS" }, responsavel: { id: "uuid", nome: "Ana Luiza" } };

export const ENDPOINTS: Endpoint[] = [
  // ---------- Apoio ----------
  {
    id: "escolas", modulo: "apoio", metodo: "GET", caminho: "/escolas", titulo: "Listar escolas e opções",
    descricao: "Retorna as escolas, as séries e origens aceitas no cadastro de leads e os funis com suas etapas.",
    resposta: { ok: true, escolas: [{ id: "uuid", nome: "Centro", series: ["INF I", "1º EF"], origens: ["WhatsApp", "Site"], funis: [{ id: "uuid", nome: "Centro - LEADS", etapas: [{ id: "uuid", nome: "Novo lead" }] }] }] },
  },
  {
    id: "usuarios", modulo: "apoio", metodo: "GET", caminho: "/usuarios", titulo: "Listar usuários / atendentes",
    descricao: "Usuários das escolas com seus perfis (Gerente, Central de Informações, Coordenação). Use o id ou o nome nos campos responsavel e atendente.",
    query: [f("escola", "texto", false, "Filtra por escola (nome ou ID).")],
    resposta: { ok: true, usuarios: [{ id: "uuid", nome: "Ana Luiza", perfis: [{ perfil: "Central de Informações", escola: "Bessa" }] }] },
  },
  {
    id: "motivos", modulo: "apoio", metodo: "GET", caminho: "/motivos", titulo: "Listar motivos de ganho e perda",
    descricao: "Motivos ativos usados em POST /pipeline/fechar.",
    resposta: { ok: true, ganho: [{ id: "uuid", motivo: "Matrícula efetivada" }], perdido: [{ id: "uuid", motivo: "Preço" }] },
  },
  // ---------- Leads ----------
  {
    id: "listar-leads", modulo: "leads", metodo: "GET", caminho: "/leads?escola=Centro&situacao=open", titulo: "Listar leads",
    descricao: "Lista os cards da Lista de LEADS, do mais novo para o mais antigo, com filtros e paginação. (Sem card_id/codigo/telefone na URL.)",
    query: [
      f("escola", "texto", false, "Nome ou ID da escola."),
      f("funil", "texto", false, "Nome ou ID do funil."),
      f("etapa", "texto", false, "Nome ou ID da etapa."),
      f("situacao", "open | won | lost", false, "Aberto, ganho ou perdido."),
      f("responsavel", "texto", false, "ID ou nome do responsável; \"nenhum\" para cards sem responsável."),
      f("origem", "texto", false, "Origem informada no cadastro (contém)."),
      f("serie", "texto", false, "Série de interesse (contém)."),
      f("busca", "texto", false, "Parte do nome ou telefone completo."),
      f("cadastro_de", "data", false, "Cadastrados a partir de (YYYY-MM-DD ou ISO)."),
      f("cadastro_ate", "data", false, "Cadastrados até (inclusive)."),
      ...pag,
    ],
    resposta: lista(cardEx),
  },
  {
    id: "consultar-lead", modulo: "leads", metodo: "GET", caminho: "/leads?codigo=1051/CE2027", titulo: "Consultar um lead (completo)",
    descricao: "Busca um card por card_id, código ou telefone e devolve todos os dados: funil, etapa, situação, agendamento, responsável, respostas do formulário e tarefas.",
    query: ref,
    resposta: { ok: true, card: { ...cardEx, respostas: { "Nome do responsável": "Maria Souza", "Série": "[\"1º EF\"]", "Origem": "Rede social" }, tarefas: [{ id: "uuid", titulo: "Ligar", vencimento: "2026-12-02", situacao: "pendente", concluida_em: null }] } },
    erros: ["card_nao_encontrado", "referencia_ausente"],
  },
  {
    id: "criar-lead", modulo: "leads", metodo: "POST", caminho: "/leads", titulo: "Criar lead",
    descricao: "Cadastra o lead na Lista de LEADS da escola, gera o código oficial e cria o card no funil conforme a regra de Destino. Se já existir lead com o mesmo telefone na escola, nada é criado e o existente é devolvido (criado: false, HTTP 200). Lead novo responde HTTP 201.",
    campos: [
      f("escola", "texto", true, "Nome (Centro, Expedicionários, Cristo, Bessa) ou ID da escola."),
      f("nome", "texto", true, "Nome do responsável/lead (2 a 120 caracteres)."),
      f("telefone", "texto", true, "Telefone com DDD."),
      f("email", "texto", false, "E-mail válido."),
      f("serie", "texto ou lista", false, "Série(s) de interesse, exatamente como em GET /escolas."),
      f("origem", "texto", false, "Origem do contato, como em GET /escolas."),
      f("observacao", "texto", false, "Anotação gravada no histórico do card."),
      f("campanha", "texto", false, "Nome da campanha de origem (máx. 60). Aparece no card como balão azul \"Campanha - <nome>\"."),
    ],
    exemplo: { escola: "Centro", nome: "Maria Souza", telefone: "(83) 99876-5432", email: "maria@email.com", serie: ["1º EF"], origem: "Rede social", campanha: "Black November", observacao: "Veio da campanha de novembro" },
    resposta: { ok: true, criado: true, lead: { codigo: "1051/CE2027", card_id: "uuid", escola: "Centro", nome: "Maria Souza", no_funil: true } },
    erros: ["escola_invalida", "telefone_invalido", "serie_invalida", "origem_invalida", "sem_formulario"],
  },
  {
    id: "editar-lead", modulo: "leads", metodo: "PATCH", caminho: "/leads", titulo: "Editar lead",
    descricao: "Altera somente os campos enviados, no card e no cadastro do formulário. O código do lead nunca muda. Cada alteração fica registrada no histórico do card e no Log de Registro.",
    campos: [
      ...ref,
      f("nome", "texto", false, "Novo nome."),
      f("novo_telefone", "texto", false, "Novo telefone com DDD."),
      f("email", "texto", false, "Novo e-mail."),
      f("serie", "texto ou lista", false, "Nova(s) série(s)."),
      f("origem", "texto", false, "Nova origem."),
      f("responsavel", "texto", false, "ID ou nome do novo responsável; \"\" remove o responsável."),
      f("observacao", "texto", false, "Anotação extra no histórico."),
      f("campanha", "texto", false, "Define a campanha do card; \"\" remove."),
    ],
    exemplo: { codigo: "1051/CE2027", nome: "Maria Souza Lima", serie: ["2º EF"], responsavel: "Ana Luiza" },
    resposta: { ok: true, card: cardEx },
    erros: ["card_nao_encontrado", "usuario_invalido", "serie_invalida", "origem_invalida", "dados_invalidos"],
  },
  {
    id: "historico", modulo: "leads", metodo: "GET", caminho: "/leads/historico?codigo=1051/CE2027", titulo: "Histórico do lead",
    descricao: "Todas as anotações do card (mudanças de etapa, agendamentos, faltas, check-in, ganho/perda, notas), da mais nova para a mais antiga.",
    query: ref,
    resposta: { ok: true, card: cardMini, historico: [{ id: "uuid", autor: "Ana Luiza", texto: "Visita agendada para 03/12 às 09:00 — por Ana Luiza.", data: "2026-11-21T10:00:00+00:00" }] },
  },
  {
    id: "notas", modulo: "leads", metodo: "POST", caminho: "/notas", titulo: "Adicionar anotação",
    descricao: "Grava uma anotação no histórico do card.",
    campos: [...ref.slice(1), f("texto", "texto", true, "Conteúdo da anotação."), f("autor", "texto", false, "Nome exibido como autor.")],
    exemplo: { telefone: "83998765432", escola: "Centro", texto: "Cliente pediu retorno à tarde." },
    resposta: { ok: true, card: cardMini },
  },
  // ---------- Calendário ----------
  {
    id: "listar-agenda", modulo: "calendario", metodo: "GET", caminho: "/calendario?de=2026-12-01&ate=2026-12-31", titulo: "Consultar agenda",
    descricao: "Lista os agendamentos do período em ordem de data, com quem agendou (\"agendado_por\"). tipo = visita (LEADS) ou matricula (Visitantes). Faltas tiram o agendamento da agenda até o reagendamento.",
    query: [
      f("de", "data", true, "Início do período (YYYY-MM-DD ou ISO)."),
      f("ate", "data", true, "Fim do período (inclusive)."),
      f("escola", "texto", false, "Nome ou ID da escola."),
      f("tipo", "visita | matricula", false, "Tipo de agendamento."),
      f("situacao", "agendado | realizado | cancelado", false, "agendado = card aberto; realizado = ganho; cancelado = perdido."),
      f("atendente", "texto", false, "ID ou nome do responsável."),
      ...pag,
    ],
    resposta: lista({ card_id: "uuid", codigo: "1051/CE2027", nome: "1051/CE2027 · Maria Souza", telefone: "(83) 99876-5432", tipo: "visita", data_hora: "2026-12-03T12:00:00+00:00", situacao: "agendado", escola: "Centro", funil: "Centro - LEADS", etapa: "Visita agendada", agendado_por: "Ana Luiza", responsavel: { id: "uuid", nome: "Ana Luiza" } }),
  },
  {
    id: "agendar", modulo: "calendario", metodo: "POST", caminho: "/calendario", titulo: "Agendar ou reagendar",
    descricao: "Grava a data no card, move para \"Visita agendada\" (LEADS) ou \"Matrícula agendada\" (Visitantes) e registra no histórico e no Calendário. Chamar de novo reagenda (vale a data mais recente). O endereço antigo POST /agendamentos continua funcionando igual.",
    campos: [
      ...ref,
      f("data_hora", "data ISO 8601", true, "Com fuso, ex.: 2026-12-03T09:00:00-03:00."),
      f("atendente", "texto", false, "Nome de quem agendou (aparece em \"Agendado por\")."),
      f("observacao", "texto", false, "Complemento da anotação."),
    ],
    exemplo: { codigo: "1051/CE2027", data_hora: "2026-12-03T09:00:00-03:00", atendente: "Ana Luiza" },
    resposta: { ok: true, tipo: "visita", card: cardMini },
    erros: ["card_nao_encontrado", "card_fechado"],
  },
  {
    id: "cancelar", modulo: "calendario", metodo: "DELETE", caminho: "/calendario", titulo: "Cancelar agendamento",
    descricao: "Remove a data do card (ele continua na etapa atual) e registra o cancelamento no histórico.",
    campos: [...ref, f("motivo", "texto", false, "Motivo do cancelamento.")],
    exemplo: { codigo: "1051/CE2027", motivo: "Família pediu para remarcar depois" },
    resposta: { ok: true, card: { ...cardMini, agendamento: null } },
    erros: ["sem_agendamento", "card_fechado"],
  },
  {
    id: "checkin", modulo: "calendario", metodo: "POST", caminho: "/calendario/checkin", titulo: "Check-in (visita realizada)",
    descricao: "Somente LEADS. Confirma que a família compareceu: o card vira ganho na etapa \"Visita realizada\", as tarefas abertas são concluídas e o check-in aparece na Lista de LEADS. Não pode ser desfeito.",
    campos: ref,
    exemplo: { codigo: "1051/CE2027" },
    resposta: { ok: true, checkin_em: "2026-12-03T12:15:00.000Z", card: { ...cardMini, etapa: "Visita realizada", situacao: "won" } },
    erros: ["somente_leads", "checkin_existente"],
  },
  {
    id: "falta", modulo: "calendario", metodo: "POST", caminho: "/calendario/falta", titulo: "Registrar falta",
    descricao: "A família não compareceu: o card vai para a etapa de reagendamento (\"Reagendar visita\" / \"Reagendar Matrícula\") e a data é removida. Para remarcar, use POST /calendario.",
    campos: ref,
    exemplo: { codigo: "1051/CE2027" },
    resposta: { ok: true, card: { ...cardMini, etapa: "Reagendar visita", agendamento: null } },
    erros: ["sem_agendamento", "etapa_ausente"],
  },
  // ---------- Pipeline ----------
  {
    id: "pipeline", modulo: "pipeline", metodo: "GET", caminho: "/pipeline?escola=Centro", titulo: "Funis e etapas (com contagem)",
    descricao: "Lista os funis com as etapas em ordem e quantos cards há em cada etapa.",
    query: [f("escola", "texto", false, "Nome ou ID da escola.")],
    resposta: { ok: true, funis: [{ id: "uuid", nome: "Centro - LEADS", escola: "Centro", etapas: [{ id: "uuid", nome: "Novo lead", posicao: 0, cards: 12 }] }] },
  },
  {
    id: "cards", modulo: "pipeline", metodo: "GET", caminho: "/pipeline/cards?funil=Centro - LEADS&etapa=Novo lead", titulo: "Listar cards do pipeline",
    descricao: "Igual à lista de leads, mas inclui também os cards de Visitantes. Aceita os mesmos filtros e mais tipo.",
    query: [f("tipo", "leads | visitantes", false, "Tipo de lista."), f("escola", "texto", false, "Nome ou ID."), f("funil", "texto", false, "Nome ou ID."), f("etapa", "texto", false, "Nome ou ID."), f("situacao", "open | won | lost", false, "Situação."), f("responsavel", "texto", false, "ID, nome ou \"nenhum\"."), f("busca", "texto", false, "Nome ou telefone."), ...pag],
    resposta: lista(cardEx),
  },
  {
    id: "etapa", modulo: "pipeline", metodo: "POST", caminho: "/etapa", titulo: "Mover etapa",
    descricao: "Move o card para outra etapa do mesmo funil. Para ganho/perda use POST /pipeline/fechar.",
    campos: [...ref.slice(1), f("etapa", "texto", true, "Nome ou ID da etapa, como em GET /pipeline.")],
    exemplo: { codigo: "1051/CE2027", etapa: "Em atendimento" },
    resposta: { ok: true, card: { ...cardMini, etapa: "Em atendimento" } },
    erros: ["etapa_invalida", "etapa_restrita", "card_fechado"],
  },
  {
    id: "transferir", modulo: "pipeline", metodo: "POST", caminho: "/pipeline/transferir", titulo: "Transferir para outro funil",
    descricao: "Move o card para a primeira etapa de outro funil da mesma escola (ex.: card criado no funil errado).",
    campos: [...ref, f("funil", "texto", true, "Nome ou ID do funil de destino."), f("observacao", "texto", false, "Motivo da transferência.")],
    exemplo: { codigo: "1051/CE2027", funil: "Centro - Visitantes" },
    resposta: { ok: true, card: { ...cardEx, funil: "Centro - Visitantes", etapa: "Novo visitante" } },
    erros: ["funil_invalido", "funil_sem_etapas", "card_fechado"],
  },
  {
    id: "responsavel", modulo: "pipeline", metodo: "POST", caminho: "/pipeline/responsavel", titulo: "Trocar responsável",
    descricao: "Define o atendente responsável pelo card (\"\" remove).",
    campos: [...ref, f("responsavel", "texto", true, "ID ou nome, como em GET /usuarios.")],
    exemplo: { codigo: "1051/CE2027", responsavel: "Ana Luiza" },
    resposta: { ok: true, card: cardEx },
    erros: ["usuario_invalido"],
  },
  {
    id: "fechar", modulo: "pipeline", metodo: "POST", caminho: "/pipeline/fechar", titulo: "Marcar ganho ou perda",
    descricao: "Fecha o card com um motivo. Ganho move para \"Visita realizada\" (LEADS) ou \"Matriculado\" (Visitantes); perda move para \"Perdido\". Em Visitantes, o ganho exige a quantidade de matrículas e marca o cadastro como matriculado. Tarefas abertas são concluídas.",
    campos: [
      ...ref,
      f("resultado", "ganho | perdido", true, "Resultado."),
      f("motivo", "texto", true, "ID ou texto do motivo, como em GET /motivos."),
      f("matriculas", "número", false, "Obrigatório no ganho de Visitantes (1 a 20)."),
      f("observacao", "texto", false, "Observação do fechamento."),
    ],
    exemplo: { codigo: "2051/CR2027", resultado: "ganho", motivo: "Matrícula efetivada", matriculas: 2 },
    resposta: { ok: true, card: { ...cardMini, etapa: "Matriculado", situacao: "won" } },
    erros: ["motivo_invalido", "matriculas_obrigatorias", "etapa_ausente", "card_fechado"],
  },
  // ---------- Tarefas ----------
  {
    id: "listar-tarefas", modulo: "tarefas", metodo: "GET", caminho: "/tarefas?situacao=atrasada&escola=Centro", titulo: "Listar tarefas",
    descricao: "Lista tarefas, primeiro as abertas por vencimento. situacao: pendente (sem vencimento ou vencendo hoje/depois), atrasada (vencida e aberta), concluida.",
    query: [
      f("escola", "texto", false, "Nome ou ID."), f("funil", "texto", false, "Nome ou ID."),
      f("card_id / codigo / telefone", "texto", false, "Tarefas de um card."),
      f("responsavel", "texto", false, "ID ou nome do responsável do card."),
      f("situacao", "pendente | atrasada | concluida", false, "Situação."),
      f("vencimento_de", "data", false, "YYYY-MM-DD."), f("vencimento_ate", "data", false, "YYYY-MM-DD."),
      ...pag,
    ],
    resposta: lista(taskEx),
  },
  {
    id: "criar-tarefa", modulo: "tarefas", metodo: "POST", caminho: "/tarefas", titulo: "Criar tarefa",
    descricao: "Cria uma tarefa no card. A tarefa é do responsável do card; se enviar responsavel, ele passa a ser o responsável do card. Responde HTTP 201.",
    campos: [...ref, f("titulo", "texto", true, "Descrição da tarefa (até 200)."), f("vencimento", "data", false, "YYYY-MM-DD."), f("responsavel", "texto", false, "ID ou nome do atendente.")],
    exemplo: { codigo: "1051/CE2027", titulo: "Ligar para confirmar visita", vencimento: "2026-12-02" },
    resposta: { ok: true, tarefa: taskEx },
    erros: ["card_fechado", "usuario_invalido"],
  },
  {
    id: "editar-tarefa", modulo: "tarefas", metodo: "PATCH", caminho: "/tarefas/{id}", titulo: "Editar, concluir ou reabrir tarefa",
    descricao: "Altera título e vencimento, conclui (concluida: true, com observacao obrigatória — vai para o histórico do card) ou reabre (concluida: false).",
    campos: [f("titulo", "texto", false, "Novo título."), f("vencimento", "data ou null", false, "YYYY-MM-DD; null remove."), f("concluida", "booleano", false, "true conclui, false reabre."), f("observacao", "texto", false, "O que foi feito (obrigatória ao concluir).")],
    exemplo: { concluida: true, observacao: "Família confirmou presença." },
    resposta: { ok: true, tarefa: { ...taskEx, situacao: "concluida", concluida_em: "2026-12-02T13:00:00.000Z" } },
    erros: ["tarefa_nao_encontrada", "observacao_obrigatoria"],
  },
  {
    id: "excluir-tarefa", modulo: "tarefas", metodo: "DELETE", caminho: "/tarefas/{id}", titulo: "Excluir tarefa",
    descricao: "Apaga a tarefa definitivamente.",
    resposta: { ok: true, excluida: "uuid" },
    erros: ["tarefa_nao_encontrada"],
  },
];

export const ERRORS: [number, string, string][] = [
  [400, "json_invalido", "O corpo não é um JSON válido."],
  [401, "nao_autorizado", "Chave ausente, inválida ou revogada."],
  [404, "card_nao_encontrado / tarefa_nao_encontrada", "Registro não encontrado com a referência informada."],
  [409, "card_fechado", "O card já foi ganho ou perdido."],
  [409, "sem_agendamento / checkin_existente", "Card sem data agendada, ou check-in já confirmado."],
  [422, "dados_invalidos / referencia_ausente", "Campo faltando ou em formato errado; a mensagem explica qual."],
  [422, "escola_invalida / funil_invalido / etapa_invalida / usuario_invalido / motivo_invalido", "Valor não encontrado; consulte as rotas de Apoio e GET /pipeline."],
  [422, "serie_invalida / origem_invalida / telefone_invalido", "Valor fora das opções do formulário da escola."],
  [422, "etapa_restrita / somente_leads / matriculas_obrigatorias / observacao_obrigatoria / etapa_ausente", "Regra do portal não atendida; a mensagem explica."],
  [500, "erro_interno", "Falha inesperada; tente novamente em alguns segundos."],
];

// Seções explicativas (tela, .md e PDF).
export const GUIA: { titulo: string; itens: string[] }[] = [
  { titulo: "Autenticação", itens: [
    "Todas as chamadas exigem o cabeçalho Authorization: Bearer <chave>. A chave é gerada pelo administrador em Configurações › API e aparece uma única vez.",
    "Gere uma chave por sistema integrado. Revogar a chave bloqueia o sistema imediatamente.",
    "Todas as gravações ficam no Log de Registro do portal com o nome da chave (ex.: \"API: CRM Comercial\").",
  ] },
  { titulo: "Formato", itens: [
    "Corpo e respostas em JSON (UTF-8), com Content-Type: application/json.",
    "Toda resposta traz ok (true/false). Em erro: { \"ok\": false, \"erro\": \"codigo\", \"mensagem\": \"texto\" } com o HTTP correspondente.",
    "Métodos: GET consulta; POST cria ou executa ação; PATCH altera só os campos enviados; DELETE remove/cancela.",
    "CORS liberado (pode ser chamado de navegador), mas nunca exponha a chave em páginas públicas: chame a partir do seu servidor.",
  ] },
  { titulo: "Datas e fuso horário", itens: [
    "Datas com hora em ISO 8601 com fuso, ex.: 2026-12-03T09:00:00-03:00. As respostas vêm em UTC (+00:00).",
    "Filtros só de data (YYYY-MM-DD) usam o horário de Brasília/Fortaleza (-03:00), dia inteiro.",
    "Vencimento de tarefa é só data (YYYY-MM-DD).",
  ] },
  { titulo: "Identificando o card", itens: [
    "Use card_id (mais seguro), codigo (ex.: 1051/CE2027) ou telefone. Com telefone, envie também escola para evitar ambiguidade.",
    "Telefones são comparados por DDD + últimos 8 dígitos: tanto faz 55, máscara ou o 9 extra.",
    "Códigos por escola: Centro 1001/CE…, Cristo 2001/CR…, Bessa 3001/BE…, Expedicionários 4001/EX…",
  ] },
  { titulo: "Paginação", itens: [
    "Rotas de lista aceitam pagina (1+) e limite (1 a 200, padrão 50) e devolvem total. Para buscar tudo, avance pagina até pagina × limite ≥ total.",
  ] },
  { titulo: "Situações", itens: [
    "Card: open (em andamento), won (ganho), lost (perdido). Cards ganhos/perdidos não aceitam agendamento, mudança de etapa nem transferência.",
    "Agenda: agendado, realizado, cancelado. Tarefa: pendente, atrasada, concluida.",
  ] },
  { titulo: "Boas práticas", itens: [
    "Consulte GET /escolas, /usuarios e /motivos e guarde os IDs; eles não mudam.",
    "Criar lead é seguro contra duplicidade: o mesmo telefone na mesma escola devolve o lead existente (criado: false).",
    "Para reagendar, chame POST /calendario de novo; não é preciso cancelar antes.",
    "Em erro 500, tente novamente com espera crescente (1s, 5s, 30s). Erros 4xx não devem ser repetidos sem corrigir os dados.",
    "Limite recomendado: até 5 chamadas por segundo por chave.",
  ] },
  { titulo: "Fluxo completo de exemplo", itens: [
    "1) GET /escolas → escolha a escola, série e origem válidas.",
    "2) POST /leads → guarde card_id e codigo.",
    "3) POST /tarefas → \"Ligar para o lead\" com vencimento.",
    "4) POST /calendario → agenda a visita (o card vai para \"Visita agendada\").",
    "5) No dia: POST /calendario/checkin (compareceu) ou POST /calendario/falta (não compareceu → reagendar).",
    "6) Visitantes: POST /pipeline/fechar com resultado ganho e matriculas, ou perdido com motivo.",
    "7) Acompanhe com GET /leads?codigo=…, GET /leads/historico e GET /calendario.",
  ] },
];

const hasBody = (e: Endpoint) => e.metodo !== "GET" && Boolean(e.exemplo);
const urlOf = (e: Endpoint) => `${API_BASE}${e.caminho.replace("{id}", "ID_DA_TAREFA")}`;

export function curl(e: Endpoint, key = "SUA_CHAVE") {
  const url = urlOf(e);
  if (e.metodo === "GET") return `curl "${url}" \\\n  -H "Authorization: Bearer ${key}"`;
  return `curl -X ${e.metodo} "${url}" \\\n  -H "Authorization: Bearer ${key}"${hasBody(e) ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(e.exemplo)}'` : ""}`;
}

export function jsCode(e: Endpoint) {
  const url = urlOf(e);
  if (e.metodo === "GET") return `const r = await fetch("${url}", {\n  headers: { Authorization: "Bearer " + process.env.PORTAL_API_KEY },\n});\nconsole.log(await r.json());`;
  return `const r = await fetch("${url}", {\n  method: "${e.metodo}",\n  headers: {\n    Authorization: "Bearer " + process.env.PORTAL_API_KEY,\n    "Content-Type": "application/json",\n  },${hasBody(e) ? `\n  body: JSON.stringify(${JSON.stringify(e.exemplo, null, 2).replace(/\n/g, "\n  ")}),` : ""}\n});\nconsole.log(await r.json());`;
}

export function pyCode(e: Endpoint) {
  const url = urlOf(e);
  const m = e.metodo.toLowerCase();
  return `import os, requests\nr = requests.${m}("${url}",\n    headers={"Authorization": "Bearer " + os.environ["PORTAL_API_KEY"]}${hasBody(e) ? `,\n    json=${JSON.stringify(e.exemplo, null, 4).replace(/\n/g, "\n    ")}` : ""})\nprint(r.json())`;
}

export function markdownDoc() {
  const out: string[] = [
    "# API do Portal de Matrículas — Grupo Intereducacional", "",
    `URL base: \`${API_BASE}\``, "", "## Sumário", "",
    ...MODULOS.map((m) => `- ${m.titulo}: ${ENDPOINTS.filter((e) => e.modulo === m.id).map((e) => `\`${e.metodo} ${e.caminho.split("?")[0]}\``).join(", ")}`), "",
  ];
  for (const g of GUIA) out.push(`## ${g.titulo}`, "", ...g.itens.map((i) => `- ${i}`), "");
  for (const m of MODULOS) {
    out.push(`# ${m.titulo}`, "", m.descricao, "");
    for (const e of ENDPOINTS.filter((x) => x.modulo === m.id)) {
      out.push(`## ${e.titulo}`, "", `\`${e.metodo} ${e.caminho}\``, "", e.descricao, "");
      for (const [label, fs] of [["Parâmetros da URL", e.query], ["Campos do corpo (JSON)", e.campos]] as const) {
        if (!fs) continue;
        out.push(`${label}:`, "", "| Campo | Tipo | Obrigatório | Descrição |", "|---|---|---|---|");
        for (const x of fs) out.push(`| ${x.nome} | ${x.tipo} | ${x.obrigatorio ? "sim" : "não"} | ${x.descricao} |`);
        out.push("");
      }
      out.push("cURL:", "", "```bash", curl(e), "```", "", "JavaScript:", "", "```js", jsCode(e), "```", "", "Python:", "", "```python", pyCode(e), "```", "", "Resposta:", "", "```json", JSON.stringify(e.resposta, null, 2), "```", "");
      if (e.erros?.length) out.push(`Erros possíveis: ${e.erros.map((x) => `\`${x}\``).join(", ")}`, "");
    }
  }
  out.push("## Erros", "", "| HTTP | erro | Significado |", "|---|---|---|");
  for (const [s, c, d] of ERRORS) out.push(`| ${s} | ${c} | ${d} |`);
  return out.join("\n");
}
