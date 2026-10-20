# Calendário: "Visita" escrito logo após o horário

## O que muda
- Cada agendamento no Calendário passa a mostrar o tipo logo depois do horário, por exemplo **"09:00 - Visita"**, e embaixo vêm o ID e o nome. Isso vale nas visões Mês, Semana e Dia.
- Hoje o Calendário só tem visitas, então todos os itens mostram "Visita". Quando os agendamentos de matrícula entrarem, numa etapa futura, vão aparecer como **"10:00 - Matrícula"**, do mesmo jeito.
- As cores da situação continuam iguais: laranja para Agendada, verde para Realizada e vermelho para Não realizada.

## Detalhes técnicos
- `calendario.functions.ts`: adicionar o campo `kind: "visita"` em `CalendarEvent`, para facilitar a entrada de `"matricula"` mais tarde.
- `calendario.tsx`: criar o mapa `KIND_LABEL` (`visita: "Visita"`, `matricula: "Matrícula"`) e, no `chip`, mostrar `HH:mm - {KIND_LABEL[kind]}` em negrito, com o título logo abaixo.
