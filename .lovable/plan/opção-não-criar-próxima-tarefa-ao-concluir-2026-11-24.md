# Opção "Não criar próxima tarefa" ao concluir

## O que muda
Na janela **Concluir e agendar próxima** (Pipeline e Tarefas), logo abaixo do campo **Data**, aparece a caixa de marcar **"Não criar próxima tarefa"**.

- Ao marcar, os campos Atividade e Data ficam desativados e deixam de ser obrigatórios; o botão vira **Concluir sem próxima tarefa**.
- Ao clicar no botão, abre um pop-up de confirmação: **"Tem certeza que não irá criar a próxima tarefa? Este cartão ficará sem próximo passo agendado."** com **Voltar** e **Sim, concluir sem próxima**.
- Confirmando, a tarefa é concluída com o histórico normalmente e nenhuma nova tarefa é criada. O histórico do cartão registra "Concluída sem agendar próxima tarefa".
- O campo **O que foi feito?** continua obrigatório.
- Depois disso, o cartão fica sem tarefa e continua mostrando o aviso de "cartão sem tarefa" já existente.

## Detalhes técnicos
- `CompleteTaskDialog.tsx`: estado `skipNext` + diálogo de confirmação; `onConfirm` recebe `skipNext: true` sem `nextTask`.
- `task-flow.ts`: `validateCompletion` aceita `skipNext` e libera a exigência; teste novo em `task-flow.test.ts`.
- `tarefas.functions.ts` (`updateTask`): aceita `skip_next` no validador, repassa à regra e anota no histórico.
- Chamadas em `crm.pipeline.tsx` e `crm.tarefas.tsx` repassam o novo campo.
