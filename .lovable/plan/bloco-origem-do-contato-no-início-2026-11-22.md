# Bloco "Origem do contato" no Início

## O que muda
- Novo bloco **Origem do contato** logo abaixo de **Como conheceu a escola**, no mesmo estilo (gráfico de rosca com legenda, quantidade e %).
- Conta os cadastros pela resposta do campo **Origem** do formulário (ex.: Instagram, WhatsApp, Site, Indicação — conforme as opções de cada escola).
- Reage aos mesmos filtros do Início (escola, período, ano letivo); Gerentes/Central/Coordenação veem só a própria unidade.
- Cadastros sem origem preenchida entram como "Não informado".

## Detalhes técnicos
- `cadastros.functions.ts` (stats do Início): além dos campos "como conheceu", buscar campos cujo rótulo normalizado contém "origem"; carregar valores no mesmo `fetchValuesInBatches` e retornar `origins: IndicatorDatum[]`.
- `dashboard.tsx`: generalizar `SourcesChart` com prop `title` e renderizar `<SourcesChart title="Origem do contato" data={data.origins} />` empilhado sob o bloco atual (mesma coluna, via wrapper flex-col).
