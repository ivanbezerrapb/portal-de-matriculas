# Eu configuro o banco por você

Você não vai executar nada. Só precisa me enviar, por um formulário seguro, o endereço de conexão do seu banco — depois disso eu faço todo o resto.

## O que você faz (uma vez, ~1 minuto)

1. No painel do seu Supabase, clique em **Connect** (botão no topo).
2. Escolha **Session pooler** e copie o texto que começa com `postgresql://`.
3. Troque `[YOUR-PASSWORD]` pela senha do banco (a que você definiu ao criar o projeto).
4. Cole no formulário seguro que vou abrir. O valor fica guardado de forma criptografada e nunca aparece no chat nem no código.

## O que eu faço depois

1. Crio todas as tabelas, permissões e regras de acesso do sistema diretamente no seu banco (o conteúdo do `supabase-setup.sql`, que hoje está parado aguardando execução manual).
2. Cadastro as 4 escolas iniciais (Escola A, B, C e D) com seus prefixos de ID.
3. Ligo a criação automática de perfil e defino que a primeira conta criada vira Administrador.
4. Confirmo que tudo foi criado, conferindo tabela por tabela.
5. Testo o fluxo no navegador: criar conta, entrar, criar formulário, publicar link, enviar um cadastro pelo link público, ver o cadastro na listagem, editar e imprimir.
6. Corrijo o que aparecer de erro nesses testes.

Se preferir, também posso criar sua conta de Administrador já com um e-mail e senha que você me indicar — assim você só entra e usa.

## Detalhes técnicos

- A string de conexão será salva como segredo `EXT_SUPABASE_DB_URL` e usada apenas no servidor.
- O SQL será aplicado via `psql` a partir do arquivo `supabase-setup.sql` já existente (tabelas, grants, funções `has_role`/`user_school_ids`/`next_school_public_id`/`handle_new_user`, trigger em `auth.users`, políticas RLS e seed das escolas).
- O script é idempotente na prática só na primeira execução; se algo já existir, ajusto o SQL antes de reaplicar.
- A aplicação continua usando `EXT_SUPABASE_URL` / `EXT_SUPABASE_PUBLISHABLE_KEY` / `EXT_SUPABASE_SERVICE_ROLE_KEY` como já está.
