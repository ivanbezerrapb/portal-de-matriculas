# Botão TRANSFERIR card para outro funil da mesma unidade

## O que muda para o usuário
- Na janela do card aberto, ao lado de "Enviar mensagem", aparece o botão **Transferir**.
- Ao clicar, abre uma janela "Transferir para outro funil" com a lista dos **outros funis da mesma escola** (agrupados LEADS / Visitantes, na ordem padrão), e um campo opcional de observação.
- Ao confirmar, o card vai para a **primeira etapa** do funil escolhido, mantendo cliente, histórico, tarefas e notas.
- O responsável do card é mantido se ele também estiver vinculado ao funil de destino; caso contrário fica sem responsável confirmado (será pedido na próxima movimentação, como já acontece hoje).
- O histórico do card e o Log registram: "Transferido do funil X para o funil Y por Fulano".

## Quem pode transferir
- Administrador (qualquer escola), Gerente da unidade (suas escolas) e Central de Informações vinculada ao funil de origem.
- Direção e perfis somente leitura não veem o botão. Cards já ganhos ou perdidos não podem ser transferidos (reabrir primeiro).

## Detalhes técnicos
- Nova server fn `transferOpportunity({ id, funnel_id, note? })` em `pipeline.functions.ts`: valida permissão via `getPerms`, confere que o funil de destino é da mesma `school_id` e diferente do atual, pega a etapa de menor `position`, atualiza `funnel_id`, `stage_id`, `position` (fim da coluna) e, se o dono não pertencer ao funil, limpa `owner_confirmed_at`; grava `crm_notes` e `activity_logs`.
- UI em `crm.pipeline.tsx`: componente `TransferFunnel` com Dialog + lista de funis (reaproveita ordenação `compareSchoolNames`/grupos já usados no seletor do Pipeline); após sucesso fecha o card e invalida a consulta do pipeline.
- Teste pequeno da regra (mesma escola, funil diferente, card aberto) junto aos testes existentes.
