# Legenda da Evolução acumulada reagindo a Mês / Dia

## Comportamento
- **Mês**: sem mudança. Os números ao lado de 2025 / 2026 / 2027 continuam mostrando o acumulado de 01/08 até a mesma data de hoje em cada ano.
- **Dia**: os números passam a mostrar o acumulado **do início da campanha (01/08 de cada ano letivo) até a data selecionada**, respeitando o ano de cada linha.
  - Data selecionada padrão: hoje, se o mês escolhido for o atual; senão, o último dia do mês escolhido (ex.: Set → 30/09).
  - Ao clicar em um dia do gráfico, essa passa a ser a data selecionada e a legenda é atualizada. Uma linha vertical marca o dia escolhido, e o texto mostra "até DD/MM".
  - Para o ano atual, datas futuras param em hoje (não há dados depois de hoje).
  - Trocar de mês volta para a data padrão daquele mês.
- O botão Visitas / Crianças continua valendo nos dois modos.

## Detalhes técnicos
- Apenas `src/routes/_authenticated/dashboard.tsx` (`CumulativeChart`): novo estado `selectedDay`, cálculo dos valores da legenda com `dailyCumulativeAt` para cada ano quando `granularity === "day"`, `onClick` do gráfico para definir o dia, `ReferenceLine` no dia escolhido. Nenhuma mudança nos dados ou no servidor.
