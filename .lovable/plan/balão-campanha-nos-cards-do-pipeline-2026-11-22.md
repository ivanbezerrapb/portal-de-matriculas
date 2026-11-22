# Balão "Campanha" nos cards do Pipeline

## O que muda para o usuário
- Quando o card veio de uma campanha, aparece um **balão azul** no card do Pipeline (no espaço à direita, na linha da etapa — onde está marcado na imagem) com o texto **"Campanha - Black November"**.
- Também aparece no card aberto (janela grande), perto do nome.
- Cards sem campanha não mostram nada.

## Como a campanha é informada
1. **Pela API (outro CRM):** novo campo opcional `campanha` em "Criar lead" e "Editar lead". A consulta de leads e a lista de cards passam a devolver `campanha`. Enviar vazio remove.
2. **No card:** campo **Campanha** no botão **Editar** do card (Admin, Gerente, Coordenação e Central da unidade; Direção só vê).
- Toda alteração entra no histórico do card e no Log de Registro.
- Texto limitado a 60 caracteres; o balão mostra "Campanha - " + nome.

## Documentação
- O campo `campanha` entra na documentação da tela, no .md, no PDF e na coleção do Postman.

## Detalhes técnicos
- O banco externo não tem como receber coluna nova daqui; a campanha fica num mapa `cardId → campanha` no objeto privado `integracoes/campanhas.json` do storage externo, lido/gravado só no servidor (`src/lib/ext/campaign.server.ts`).
- `listOpportunities` (pipeline) anexa `campaign` a cada card; nova server function `setCardCampaign` com as mesmas permissões de edição.
- `api2.server.ts`: `createLead`/`editLead` aceitam `campanha`; `listCards`/`cardDetail` devolvem. Zod nas rotas `leads.ts`.
- Balão usa tokens do tema (azul primário, texto claro), `truncate` para nomes longos.
- Teste em `api-logic.test.ts` para normalizar/limitar o nome da campanha (vazio = remove, máx. 60).
- Regra registrada no AGENTS.md.
