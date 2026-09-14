# Remover o submenu Apresentação

## O que muda

- O submenu **Apresentação** (em Cadastros) deixa de existir: o menu **Cadastros** volta a ser um item único que abre direto a **Lista de cadastros**.
- A tela `/apresentacao` é removida; quem tiver o endereço salvo nos favoritos cai direto na Lista de cadastros.
- Nada se perde: as colunas **Atendimento** e **Apresentação** continuam na Lista de cadastros, com autocompletar e a opção "Cadastrar «nome»", e os nomes cadastrados continuam salvos e alimentando os indicadores da tela Início (Quem mais atendeu / Quem mais apresentou).

## Detalhes técnicos

- `src/routes/_authenticated/route.tsx`: o grupo "Cadastros" volta a ser um item simples (`NavLeaf`) apontando para `/cadastros`; remover a referência a `/apresentacao` dos caminhos permitidos (ou mantê-la redirecionando).
- Nova rota leve `src/routes/_authenticated/apresentacao.tsx` apenas com redirecionamento permanente para `/cadastros` (evita erro 404 em links salvos); ou remover a rota e deixar o fallback — preferir o redirecionamento.
- `src/routes/_authenticated/apresentacao.tsx` atual (listagem com PersonCell): conteúdo substituído pelo redirecionamento.
- Banco: sem mudança (`presenters`, `attendant_id`, `presenter_id` permanecem).
- Indicadores da Início e a exigência de preenchimento ao ativar matrícula: sem mudança.
