# Central de Informações pode escolher o funil na lista

## Situação
O erro apareceu com um usuário da **Central de Informações**. Hoje o envio ao funil na lista só é liberado para Administrador, Gerente e Secretaria; a Central fica barrada (antes pelo banco, com a mensagem em inglês; após a última correção, com "Você não tem permissão").

## O que muda
- A Central de Informações passa a poder escolher o funil na Lista de Visitantes e na Lista de LEADS, **somente nas unidades dela e somente nos funis vinculados a ela** (os mesmos que ela já vê no Pipeline).
- Na coluna Funil, a lista de opções da Central mostra apenas esses funis.
- Ao escolher, segue o mesmo fluxo: cartão na 1ª etapa, tarefa 1º CONTATO no próximo dia útil e Atendimento preenchido pelo responsável do funil (ou janela "Quem atendeu?" quando houver mais de um).
- Se tentar um funil que não é dela, aparece em português: "Você não tem acesso a este funil."

## Detalhes técnicos
- `cadastros.functions.ts` (`sendSubmissionToFunnel`): aceitar `perms.infoSchools.includes(school_id)`; para quem é só Central (não admin/gerente/secretaria da unidade), exigir `perms.funnelIds.includes(funnel_id)`.
- `SubmissionsList.tsx`: liberar o seletor de funil para Central e, nesse caso, filtrar as opções por `perms.funnelIds`.
- Gravação continua pelo servidor após as validações (sem mudar regras do banco).
