# Apresentação: quem apresentou a escola

## O que muda

1. **Nova tela Configurações › Apresentação** — lista dos nomes de quem apresenta a escola, separados por unidade. Cada nome pertence a uma unidade e uma unidade nunca vê os nomes de outra. O Gerente vê e cadastra apenas na sua unidade; o Administrador escolhe a unidade.
2. **Coluna APRESENTAÇÃO na listagem de cadastros** — entre Data e Matrícula. A Gerente digita o nome e a lista se autocompleta com os nomes já cadastrados da unidade daquele cadastro. Se o nome ainda não existir, aparece a opção "Cadastrar «nome»", que salva na unidade do cadastro e já vincula ao cadastro.
3. **Indicador na tela Início** — gráfico de barras "Quem mais apresentou", com a quantidade de cadastros por apresentador, respeitando o filtro de escolas e o ano de campanha (ago→jul).

Quem pode informar ou alterar: Administrador e Gerente. Secretaria e Central de Informações apenas visualizam.

## Detalhes

- Nome em branco é permitido: o cadastro fica sem apresentação ("—").
- Nomes repetidos na mesma unidade são evitados (comparação sem acentos e sem diferenciar maiúsculas).
- Na tela de Apresentação dá para renomear e desativar um nome. Desativado não aparece mais para escolher, mas os cadastros já vinculados continuam mostrando o nome.

## Técnico

Banco (migração na base externa, via psql com `/tmp/dburl`):
- `public.presenters` (`id uuid pk default gen_random_uuid()`, `school_id uuid not null references public.schools on delete cascade`, `name text not null`, `active boolean not null default true`, `created_at timestamptz default now()`), índice único em `(school_id, lower(unaccent-free normalizado))` via `lower(btrim(name))`.
- GRANTs: `select, insert, update, delete` para `authenticated`; `all` para `service_role`. RLS habilitada.
- Policies: SELECT para admin ou escolas em `public.user_crm_school_ids(auth.uid())`; INSERT/UPDATE/DELETE para admin ou `school_manager` da escola.
- `submissions.presenter_id uuid references public.presenters on delete set null` (nullable, aditivo).

Servidor:
- Novo `src/lib/ext/apresentacao.functions.ts`: `listPresenters({ school_id? })`, `createPresenter({ school_id, name })`, `updatePresenter({ id, name?, active? })`, `deletePresenter({ id })` — todos com `requireAuth` e checagem via `getPerms` (admin ou gerente da escola).
- `cadastros.functions.ts`: `listSubmissions` passa a trazer `presenter_id` e o nome via join `presenters(name)`; novo `setPresenter({ submission_id, presenter_id | new_name })` que valida permissão (admin ou gerente da escola do cadastro), cria o apresentador quando vier `new_name` e grava em `audit_log`.
- `getDashboardStats`: nova saída `presenters: { label, count }[]`, contando cadastros do período/escolas filtradas agrupados por `presenter_id` (sem apresentador não entra), ordenada decrescente.

Front:
- Nova rota `src/routes/_authenticated/apresentacao.tsx` com `head()` próprio; seletor de unidade só para admin (Gerente já fixa a sua); adicionar/renomear/ativar/desativar.
- `route.tsx`: item "Apresentação" no grupo Configurações (ícone `Presentation`), somente admin — e, para o Gerente, o mesmo item disponível no menu (fora de Configurações não é necessário: o grupo Configurações passa a aparecer para o Gerente contendo apenas Apresentação).
- `cadastros.tsx`: coluna "Apresentação" com um combobox por linha (input + lista filtrada dos nomes ativos da escola do cadastro, carregada por `listPresenters`), opção "Cadastrar «nome»", `useMutation` chamando `setPresenter` e invalidando `submissions` e `dashboard-stats`; leitura apenas quando sem permissão.
- `dashboard.tsx`: novo card "Quem mais apresentou" reutilizando o componente de barras horizontais existente, dentro da grade de indicadores.
