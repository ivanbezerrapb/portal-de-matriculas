# Corrigir erro ao salvar campos do tipo Endereço

## O que está acontecendo

Ao salvar o formulário com um campo do tipo **Endereço**, aparece a mensagem vermelha de erro e nada é gravado. São duas causas:

1. O banco ainda só aceita os tipos antigos de campo (texto, número, data, telefone, etc.). O tipo "Endereço" não está na lista permitida, então a gravação é recusada.
2. A tela aberta no navegador ainda está com a versão anterior do sistema, que também não conhecia o novo tipo — por isso a mensagem lista os tipos sem "Endereço".

## O que será feito

- Liberar o tipo "Endereço" na lista de tipos aceitos pelo banco (junto com os já existentes), sem alterar nenhum campo já cadastrado.
- Conferir, salvando de verdade em um formulário de teste, que o campo Endereço é gravado e reaparece corretamente ao recarregar a página.
- Se o erro persistir apenas no navegador, basta recarregar a página para pegar a versão nova; isso será verificado na conferência.

## Detalhes técnicos

- Migração: substituir `form_fields_type_check` por uma versão que inclua `'address'` no `ARRAY[...]`.
- A validação Zod em `src/lib/ext/formularios.functions.ts` já contém `"address"`; nenhuma mudança de código é necessária.
- Verificação: `psql` confirmando a nova constraint e um insert/rollback com `type = 'address'`.
