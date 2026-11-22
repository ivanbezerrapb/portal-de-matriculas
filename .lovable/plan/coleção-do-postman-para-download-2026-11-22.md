# Coleção do Postman para download

## O que muda
Em **Configurações › API**, ao lado de "Baixar documentação" e "Baixar PDF", um novo botão **Baixar Postman** que baixa um arquivo pronto para importar no Postman (Import › arquivo).

## O que vem configurado
- Todas as funções da API organizadas em pastas: Apoio, Leads, Calendário, Pipeline e Tarefas.
- Cada função com método, endereço, filtros de consulta (já preenchidos com exemplos e desligáveis) e corpo JSON de exemplo.
- Descrição de cada função e de cada campo, igual à documentação.
- Variáveis da coleção: `base_url` (endereço do portal) e `api_key` (chave). A autenticação por chave já fica aplicada em todas as funções: basta colar a chave em `api_key` uma vez.
- Opcional na tela: campo para colar uma chave antes de baixar, para que o arquivo já saia com ela preenchida (a chave não é guardada).

## Detalhes técnicos
- Novo `src/lib/api-postman.ts` gera JSON no formato Postman Collection v2.1 a partir de `ENDPOINTS`, `MODULOS` e `API_BASE` de `api-docs.ts` (mesma fonte da documentação, mantendo tudo sincronizado). Auth tipo bearer com `{{api_key}}`.
- Botão em `api.tsx` baixa `portal-matriculas.postman_collection.json`.
- Teste em vitest: a coleção contém um item para cada endpoint, com pastas por módulo e auth bearer.
