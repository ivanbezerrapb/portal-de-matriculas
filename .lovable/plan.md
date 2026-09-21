# Ícone do WhatsApp: número certo, endereço bloqueado

## O que a imagem mostra

O número montado está correto: `5571992049102` = país 55 + DDD 71 + 992049102.
O problema não é o número, é o endereço aberto: o link `wa.me` redireciona para
`api.whatsapp.com`, e esse endereço está sendo recusado no seu navegador
(`ERR_BLOCKED_BY_RESPONSE`, normalmente bloqueio de extensão, antivírus ou rede da escola).

## O que muda

O ícone do WhatsApp passa a abrir direto o WhatsApp Web, sem passar pelo endereço bloqueado:

- Link novo: `https://web.whatsapp.com/send?phone=55DDDNUMERO`
- Continua abrindo em nova aba, com o contato já selecionado e a conversa pronta para digitar.
- A montagem do número continua igual: DDI 55 fixo, DDD retirado do próprio telefone do cadastro,
  ícone escondido quando o telefone não tem dígitos suficientes.

Quem usar o celular ainda é levado ao aplicativo normalmente, pois o WhatsApp Web
redireciona para o app em aparelhos móveis.

## Detalhes técnicos

- `src/routes/_authenticated/crm.pipeline.tsx`: na função `whatsappHref`, trocar o retorno
  `https://wa.me/55${digits}` por `https://web.whatsapp.com/send?phone=55${digits}`.
- Nenhuma alteração no banco, nas permissões ou no histórico do cartão.

## Observação

Se `web.whatsapp.com` também estiver bloqueado nessa máquina, o bloqueio é da extensão
ou da rede; nesse caso é preciso liberar o domínio do WhatsApp nela.
