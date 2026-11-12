# Funis agrupados por categoria no seletor do Pipeline

## O que muda
No seletor **Funil** do CRM › Pipeline, a lista passa a ter dois grupos com título:

```text
LEADS
  Centro - Novo Lead
  Expedicionários - Novo Lead
  Cristo - Novo Lead
  Bessa - Novo Lead
Visitantes (Pós Visita)
  Centro - Pós Visita (...)
  Expedicionários - Pós Visita (...)
  Cristo - Pós Visita (...)
  Bessa - Pós Visita (...)
```

- Escolas sempre na ordem Centro, Expedicionários, Cristo e Bessa.
- Dentro da mesma escola, os funis ficam em ordem alfabética.
- A mesma ordem vale para a lista de funis na tela CRM › Funil.
- Um grupo vazio (sem funis para o usuário) não aparece.

## Detalhes técnicos
- Helper `sortFunnels(funnels)` e `groupFunnels` usando `funnelListType(name)` (já existente) e `compareSchoolNames` de `src/lib/school-order.ts`, com teste.
- `crm.pipeline.tsx`: trocar `funnels.map` por `<optgroup label>` por categoria.
- `crm.funil.tsx`: aplicar a mesma ordenação em `shownFunnels`.
