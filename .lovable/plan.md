# Renomear contas na tela MAXBOT

- Os blocos passam a se chamar **Maxbot Conecta** e **Maxbot Interactivo**.
- Mensagens de aviso ("Configuração do Maxbot Conecta salva", etc.) e o Log de Registro usam os mesmos nomes.
- Nada muda nas credenciais já salvas.

## Detalhes técnicos
- `title` dos `AccountCard` em `maxbot.tsx` e `ACCOUNT_LABEL` em `maxbot.functions.ts` (texto do log passa a "Configuração Maxbot Conecta salva" sem duplicar a palavra).
