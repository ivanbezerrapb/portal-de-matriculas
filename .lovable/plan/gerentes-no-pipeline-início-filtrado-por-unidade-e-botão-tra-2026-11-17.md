# Gerentes no Pipeline, Início filtrado por unidade e botão Transferir

## 1. Pipeline para Gerentes
- O menu **CRM › Pipeline** passa a aparecer para as Gerentes (hoje só Admin, Direção e Central veem).
- A Gerente vê apenas os funis da(s) unidade(s) dela; o seletor de escola/funil só lista essas unidades.
- Ela também ganha **CRM › Tarefas**, como a Central. Funil, Motivos e Atividades continuam só para Admin/Direção.

## 2. Início respeitando a unidade
- Hoje os cartões de comparação "Visitas 2026" e "Visitas 2025" (bases anteriores) somam todas as unidades quando nenhum filtro é escolhido — por isso a Gerente vê o total geral.
- Correção no servidor: para quem não é Admin/Direção, esses números sempre são calculados só com as unidades da pessoa, mesmo que ela não escolha filtro.
- Vou revisar os demais cartões e gráficos do Início (totais, comparativos, blocos de não iniciados e tarefas atrasadas) para garantir que todos sigam a mesma regra e reajam ao filtro de escola.

## 3. Botão Transferir para Gerente, Coordenação e Central
- A regra de permissão já aceita esses três perfis (somente na própria unidade). O que faltava era a Gerente chegar até o card — resolvido no item 1.
- Garantir que o botão **Transferir**, ao lado das etapas no topo do card, apareça para os três perfis em qualquer lugar onde o card for aberto, e que o servidor aceite a transferência deles.
- Direção continua sem poder transferir; cards ganhos/perdidos não mostram o botão.

## Verificação
- Testes automáticos: Gerente vê só sua unidade nos números anteriores; Gerente/Coordenação/Central podem transferir na própria unidade e não em outra.
- Abrir o portal como uma Gerente para conferir Pipeline, Início e o botão.

## Detalhes técnicos
- `route.tsx`: incluir `isManager` no grupo CRM.
- `legado.functions.ts` (`getLegacyYearStats`): usar `getPerms`; se não for admin/direção, forçar `schoolNames` = nomes das escolas de `managerSchools` (interseção com o filtro).
- Conferir `getPipeline`/lista de funis em `pipeline.functions.ts` para filtrar por `managerSchools` e o painel em `cadastros.functions.ts`/`dashboard-extra.functions.ts`.
- `crm.pipeline.tsx`: botão usa `canTransferBySchool` (já cobre manager/info/operator).
