# Completar nome e dados dos LEADS no Pipeline

## Diagnóstico

- O envio manual da Lista de LEADS copia nome, telefone e e-mail somente quando esses campos foram escolhidos na aba **Destino** do formulário.
- Quando essa configuração não existe, o cartão recebe apenas o ID, embora as respostas continuem salvas no cadastro.
- A janela lateral também depende dos dados já copiados para o cartão e dos campos extras configurados no Destino, por isso telefone e demais respostas podem ficar ausentes.

## Correção

1. Ao carregar o Pipeline, buscar as respostas do cadastro vinculado e identificar automaticamente:
   - nome do responsável/contato;
   - telefone, celular ou WhatsApp;
   - e-mail;
   - séries informadas;
   - demais respostas preenchidas.
2. Manter os campos configurados em **Destino** como prioridade e usar a identificação automática quando eles não estiverem configurados.
3. Exibir o título como **ID + Nome** no cartão e na janela lateral.
4. Exibir telefone com o botão do WhatsApp, e-mail e os demais dados preenchidos na janela lateral, sem duplicar nome, telefone, e-mail ou séries.
5. Garantir o mesmo resultado para cartões já existentes e novos, sem alterar os cadastros nem exigir novo envio ao funil.
6. Validar especificamente o LEAD **4001/EX2027** e cartões de formulários já configurados, preservando o comportamento atual destes últimos.
