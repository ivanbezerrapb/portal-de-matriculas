# Botão Transferir visível para Central, Coordenação e Gerentes

## O que acontece hoje
No card, o botão **Transferir** só aparece quando a lista de funis "de destino" tem pelo menos um funil. Essa lista é montada com os funis que o próprio usuário enxerga. A Central de Informações (ex.: ANA LUIZA) só enxerga o funil ao qual está vinculada, então a lista de destino fica vazia e o botão some, mesmo tendo permissão.

## O que vai mudar
- O botão **Transferir** passa a aparecer para Admin, Gerente, Coordenação e Central da unidade do card, sempre que o card estiver em aberto.
- Ao clicar, a janela lista **todos os funis da mesma unidade** (LEADS e Visitantes), exceto o atual, na ordem já usada no portal.
- Se a unidade não tiver outro funil, a janela avisa "Não há outro funil nesta unidade".
- Direção e cards ganhos/perdidos continuam sem o botão.

## Detalhes técnicos
- Nova server function `listTransferTargets({ opportunityId })` em `pipeline.functions.ts`: confere `canTransferBySchool(perms, school_id)` e devolve, via `extAdmin`, os funis da escola do card (exceto o atual).
- `TransferFunnel` em `crm.pipeline.tsx` deixa de receber `funnels` de `allFunnels`; busca os destinos ao abrir a janela e não esconde mais o botão quando a lista está vazia.
- `transferOpportunity` já valida pela unidade, sem exigir vínculo ao funil de destino — confirmar e manter.
