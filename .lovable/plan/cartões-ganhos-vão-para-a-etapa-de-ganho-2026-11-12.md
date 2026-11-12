# Cartões ganhos vão para a etapa de ganho

## O problema
Ao clicar em **Marcar como ganha**, o cartão muda para "Ganha", mas continua na etapa onde estava (ex.: "Reagendar Visita"). Só a perda move o cartão (para "Perdido"). O check-in e a matrícula automáticos já movem o cartão certo.

## O que muda
1. **Ao marcar como ganha**, o cartão vai sozinho para a etapa de ganho do funil:
   - Funis de **Leads**: etapa "Visita realizada".
   - Funis de **Visitantes**: etapa "Matriculado" (se o funil não tiver, usa "Visita realizada").
   - Se o funil não tiver nenhuma dessas etapas, o cartão fica onde está (sem erro).
2. **Corrigir os cartões já ganhos** que estão em outra etapa (como os 3 de "Reagendar Visita" no funil Cristo · Novo Lead), movendo cada um para a etapa de ganho do seu funil. O histórico do cartão recebe uma nota "Movido para Visita realizada (cartão ganho)".
3. Teste automático para a regra de escolha da etapa de ganho.

## Detalhes técnicos
- `closeOpportunity` em `src/lib/ext/pipeline.functions.ts`: no ramo "won", buscar `funnel_stages` do funil e incluir `stage_id` no update; helper `pickWonStage(stages, listType)` em módulo puro com teste.
- Conferir os outros caminhos que gravam `status: "won"` (`cadastros.functions.ts`, `calendario.functions.ts`) e aplicar o mesmo helper.
- Correção dos antigos: script único no banco externo para oportunidades `status='won'` cuja etapa não é a de ganho.
