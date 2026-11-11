# Verde fixo nas linhas de matriculados

- Na Lista de Visitantes, toda linha com matrícula fica verde o tempo todo, sem depender do mouse.
- Ao passar o mouse, a linha só escurece um pouco.
- Lista de LEADS continua como está.

## Detalhes técnicos
- Em `SubmissionsList.tsx`, aplicar a cor de fundo diretamente na linha com `style={{ backgroundColor }}` (cor fixa verde, ex. `#bbf7d0`) além da classe, garantindo que nenhuma regra de tema ou célula sobrescreva.
- Manter hover via classe com `brightness-95`.
- Conferir na tela com Playwright (login de teste) que a linha aparece verde sem hover.
