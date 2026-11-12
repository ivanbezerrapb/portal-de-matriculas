# Etapas do funil clicáveis dentro do cartão

## O que muda
Ao abrir um cartão no CRM, no espaço marcado (abaixo do nome e da série) aparece uma barra com **todas as etapas do funil**, na ordem, no estilo "trilha" (setas encadeadas).

- A etapa atual fica **destacada** com a cor da própria etapa e texto branco.
- As etapas já passadas ficam com a cor suave; as próximas, em cinza.
- Clicar em outra etapa **move o cartão para lá** na hora, e a barra e o quadro do Pipeline atualizam.
- O selo pequeno atual ("Em contato") é substituído por essa barra.
- Em telas estreitas (janela lateral), a barra rola para o lado.

## Mesmas regras de hoje ao arrastar
Clicar numa etapa segue exatamente o que acontece quando se arrasta o cartão:
- Se o responsável ainda não foi confirmado, abre a janela de confirmação do responsável.
- Ao ir para "Visita agendada" (Leads) ou "Matrícula agendada" (Visitantes), abre a janela pedindo a data.
- Quem não pode mover (Direção, perfis só leitura) ou cartões já ganhos/perdidos: a barra aparece, mas sem clique.
- A mudança entra no histórico e no Log como já acontece hoje.

## Detalhes técnicos
- Arquivo único: `src/routes/_authenticated/crm.pipeline.tsx`.
- Extrair a lógica do `onDrop` para uma função `requestMove(cardId, stageId)` (confirmação de responsável → `needsVisit`/`openVisitMove` → `moveM.mutate`), usada pelo arrastar e pelo clique na etapa; posição = fim da coluna de destino.
- Novo bloco `StageStepper` renderizado no lugar do selo de etapa (linhas ~879-890), usando `stages` e `card.stage_id`; desabilitado quando `!canWrite`, `statusFilter !== "open"`/cartão não aberto, ou mutação em andamento.
- Sem mudança no servidor: `moveOpportunity` já valida permissões.
