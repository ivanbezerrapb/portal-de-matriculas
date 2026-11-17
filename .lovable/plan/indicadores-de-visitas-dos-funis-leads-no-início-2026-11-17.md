# Indicadores de visitas dos funis LEADS no Início

## O que vai aparecer
Logo abaixo do bloco **Tarefas atrasadas**, um novo bloco **Visitas (funis LEADS)** em largura total, dividido em 2 colunas na mesma linha:

1. **Visitas agendadas e realizadas** — barras por escola (ordem Centro, Expedicionários, Cristo e Bessa) com:
   - Agendadas: todas as visitas marcadas nos cards LEADS (inclui as que já aconteceram e as que faltaram)
   - Realizadas: visitas com check-in feito
   - Total geral no topo.
2. **Taxa de comparecimento** — por escola e no geral: realizadas ÷ visitas cuja data já passou (realizadas + faltas + vencidas sem check-in). Percentual em selo vermelho com fonte branca, como nos outros gráficos.

Em telas estreitas, as duas colunas ficam uma embaixo da outra.

## Regras
- Conta só funis do tipo LEADS (Visitantes não entram).
- Segue os filtros do Início (escola e período, pela data da visita).
- Gerentes, Central e Coordenação veem só a própria unidade; Admin e Direção veem todas.

## Detalhes técnicos
- Nova server function `getLeadVisitStats({ schoolIds, from, to })` em `dashboard-extra.functions.ts`, com a mesma restrição por unidade de `getDashboardBacklog`.
- Fontes: `opportunities.visit_at` (submissions.list_type = "leads"), check-ins em `audit_log` (action `check_in`) e faltas pelas notas "Faltou à visita agendada para …" em `crm_notes` (o visit_at é apagado na falta, então a data vem da nota).
- Cálculo em `lead-visits-logic.ts` com teste (agendadas, realizadas, taxa = realizadas ÷ vencidas; 0 vencidas → "—").
- Novo componente no `dashboard.tsx` com grid `md:grid-cols-2`.
