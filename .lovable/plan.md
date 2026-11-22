# API completa: Calendário, Leads, Pipeline e Tarefas

Hoje a API tem 6 funções (escolas, criar/consultar lead, agendar, mover etapa, anotação). Vamos ampliá-la para cobrir os quatro módulos pedidos, com documentação completa na tela, no arquivo e no PDF.

## Novas funções da API

**Leads**
- Listar leads com filtros (escola, funil, etapa, situação, período de cadastro, origem, série, busca por nome/telefone) e paginação.
- Consultar um lead (por código, telefone ou ID) — já existe, passa a trazer também respostas do formulário, responsável e histórico resumido.
- Criar lead — já existe.
- Editar lead (nome, telefone, e-mail, série, origem, observação, responsável) — altera só os campos enviados.
- Histórico do lead (anotações, mudanças de etapa, agendamentos).

**Calendário**
- Listar agendamentos por período, escola, tipo (visita/matrícula), situação (agendado, realizado, faltou) e atendente.
- Criar/reagendar — já existe.
- Cancelar agendamento.
- Registrar check-in (compareceu) e falta.

**Pipeline**
- Listar funis e etapas (com quantidade de cards por etapa).
- Listar cards de um funil/etapa com filtros e paginação.
- Mover etapa — já existe.
- Transferir card para outro funil da mesma unidade.
- Trocar responsável.
- Marcar ganho ou perda (com motivo; matrículas obrigatórias em Visitantes), seguindo as mesmas regras do portal.

**Tarefas**
- Listar tarefas (por escola, card, responsável, situação: pendente, concluída, atrasada; período de vencimento).
- Criar tarefa no card (título, descrição, vencimento, responsável).
- Editar tarefa e concluir/reabrir.
- Excluir tarefa.

**Apoio**
- Listar usuários/atendentes por escola (para preencher "responsável" e "atendente").
- Listar motivos de ganho/perda.

## Documentação

Reescrita completa, agrupada por módulo (Introdução, Autenticação, Leads, Calendário, Pipeline, Tarefas, Apoio, Erros):
- Para cada função: método, endereço, descrição, parâmetros de busca, campos com tipo/obrigatório/exemplo, exemplos em cURL, JavaScript e Python, resposta de sucesso e erros possíveis.
- Seções extras: paginação, filtros de data e fuso horário, formato de telefone e código, limites de uso, boas práticas (evitar duplicados, reagendamento), glossário de situações e um guia passo a passo de fluxos comuns (lead do site → agendamento → check-in → ganho).
- Tela em Configurações › API com índice lateral por módulo; download em arquivo e em PDF com sumário.

## Regras mantidas
- Tudo exige chave de API; cada chamada é registrada no Log de Registro com o nome da chave.
- Duplicidade por telefone continua bloqueada na criação.
- Ganho em Visitantes exige matrículas; ganho move para a etapa de ganho, como no portal.

## Detalhes técnicos
- Novas rotas em `src/routes/api/public/v1/` (ex.: `leads/$id`, `calendario`, `calendario/checkin`, `pipeline/cards`, `pipeline/transferir`, `pipeline/fechar`, `tarefas`, `tarefas/$id`, `usuarios`, `motivos`), com GET/POST/PATCH/DELETE.
- Lógica em `api.server.ts`, reaproveitando as regras existentes (`won-stage`, `applyDestination`, check-in/faltou, tarefas) para não divergir do portal.
- `api-docs.ts` passa a ter módulos e campos ricos; `api-docs-pdf.ts` e `api.tsx` renderizam por módulo.
- Testes em `api-logic.test.ts` para filtros, paginação, ganho exigindo matrícula e bloqueio de duplicados.
- Testes manuais só com consultas (sem criar dados reais), como antes.
