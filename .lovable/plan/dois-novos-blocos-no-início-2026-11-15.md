# Dois novos blocos no Início

Adicionados no final da página Início, logo abaixo de "Quem mais atendeu (Central de Informações)", respeitando os filtros já existentes (escola, período) e a ordem das unidades Centro, Expedicionários, Cristo e Bessa.

## Bloco 1 — Cards não iniciados (1ª etapa)
- Conta os cards **abertos** que estão parados na **primeira etapa** do seu funil (ex.: "Novo Lead").
- Assim que o card vai para a 2ª etapa ou adiante, ou é marcado ganho/perdido, deixa de contar.
- Exibição: uma coluna por unidade, com barras por funil (LEADS e Visitantes), mostrando a quantidade.

## Bloco 2 — Tarefas atrasadas por atendente (Central de Informações)
- Conta as tarefas **não concluídas com data já vencida**, por usuário da Central de Informações.
- Exibição: barras horizontais vermelhas por atendente, do que tem mais atrasadas para o que tem menos, separadas por unidade.

## Detalhes técnicos
- Nova consulta no servidor em `cadastros.functions.ts` (mesma permissão do painel): 1ª etapa = menor `position` das etapas do funil; tarefas atrasadas = `due_at < agora` e não concluídas, agrupadas pelo responsável com papel Central.
- Renderização em `dashboard.tsx` com o mesmo estilo de gráfico (Recharts) dos blocos atuais; ordem via `compareSchoolNames`.
