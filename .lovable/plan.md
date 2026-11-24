# Pop-up de data ao escolher o tipo da tarefa

## O que muda
No card do Pipeline, área **Tarefas**: ao escolher a atividade (ex.: "Lembrete"), abre na hora uma janela **"Quando será esta tarefa?"** com:
- nome da atividade escolhida no topo;
- calendário para escolher a data (datas passadas bloqueadas);
- botões **Cancelar** e **Agendar tarefa**.

Ao confirmar, a tarefa é criada direto com a data escolhida (sem precisar clicar em Adicionar). Ao cancelar, a atividade volta para "Selecione a atividade…" e nada é criado.

O campo de data e o botão Adicionar abaixo continuam como estão, como alternativa.

## Detalhes técnicos
- `src/routes/_authenticated/crm.pipeline.tsx`: no `onChange` do Select de atividade, guardar o título e abrir um Dialog (shadcn) com `Calendar` (mode single, `pointer-events-auto`, `disabled` para dias < hoje em America/Fortaleza).
- Confirmar: `setDue(yyyy-MM-dd)` e chamar `createM.mutate()` com título+data; respeita as regras existentes (uma tarefa pendente por cartão).
- Dialog com z-index acima do card aberto.
