# Indicador de Coordenação para a Lista de LEADS

## O que muda
- Logo abaixo do card "Quem mais atendeu (Coordenação)", no Início, entra um novo card: **"Quem mais atendeu — LEADS (Coordenação)"**.
- Ele é igual ao card atual, mas conta só os cadastros da **Lista de LEADS**:
  - **Vinculados**: LEADS ligados a cada responsável (campo Atendimento).
  - **Iniciados**: cards que esse responsável já moveu para a 2ª etapa ou além (mesma regra de hoje).
- Também separado por unidade (Bessa, Centro, Cristo, Expedicionários), com os mesmos filtros de escola e ano letivo.
- O card atual continua contando só a Lista de Visitantes.

## Detalhes técnicos
- Em `cadastros.functions.ts`, transformar o cálculo de `attendantsBySchool` (vinculados + iniciados) numa função auxiliar e executá-la também para os envios com `list_type = "leads"`, devolvendo `leadAttendantsBySchool`.
- Em `dashboard.tsx`, renderizar outro `NeighborhoodChart` com `showStarted` usando esses dados, logo abaixo do atual.
