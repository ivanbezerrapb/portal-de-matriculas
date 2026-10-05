# Legenda do gráfico acompanha o mouse

## Objetivo

No card "Evolução acumulada", os números da legenda no topo (2025, 2026, 2027) devem mostrar os mesmos valores do balão que aparece ao passar o mouse sobre o gráfico. Hoje a legenda fica fixa no dia selecionado, enquanto o balão muda a cada ponto.

## Comportamento

- **Modo Dia:** ao passar o mouse sobre um dia do gráfico, os números do topo mudam para os valores acumulados daquele dia, iguais aos do balão. O texto "até DD/MM" também acompanha o dia sob o mouse.
- Ao tirar o mouse do gráfico, os números voltam ao dia selecionado (clicado) ou ao dia padrão (hoje, no mês atual; último dia, nos demais meses).
- Clicar em um dia continua fixando a data, como hoje.
- **Modo Mês:** ao passar o mouse sobre um mês, os números do topo mostram o acumulado daquele mês; sem mouse, voltam a mostrar o acumulado até a data de hoje.
- O botão Visitas / Crianças continua valendo para os dois modos.

## Detalhes técnicos

- Em `src/routes/_authenticated/dashboard.tsx` (`CumulativeChart`):
  - Novo estado `hoveredLabel` (dia ou mês sob o mouse), alimentado por `onMouseMove`/`onMouseLeave` do `LineChart`.
  - A legenda passa a calcular o valor com base no ponto sob o mouse quando existir; caso contrário, usa o dia/mês selecionado (lógica atual de `legendValue`/`effectiveDay`).
  - O rótulo "até DD/MM" usa o dia sob o mouse quando houver.
- Nenhuma mudança em dados, banco ou outras telas.

## Validação

- `bunx tsgo --noEmit` limpo e build OK.
- Conferência visual fica com o usuário no preview: passar o mouse sobre dias e meses e verificar que os números do topo batem com o balão.
