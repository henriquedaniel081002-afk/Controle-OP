# Controle de OP — Neon

Versão migrada do Supabase para **Neon PostgreSQL**.

## Arquitetura

- Frontend: React + Vite + TypeScript + Tailwind.
- Backend: funções serverless `/api/*` no Vercel.
- Banco: Neon PostgreSQL usando `DATABASE_URL` somente no servidor.
- Login: sessão HTTP-only assinada no servidor. Os usuários são configurados por variáveis de ambiente.
- Atualização entre usuários: atualização automática do painel a cada 30 segundos, além das atualizações imediatas após importação e marcação.

## Variáveis no Vercel

Configure em **Project > Settings > Environment Variables**:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=uma-chave-aleatoria-com-pelo-menos-32-caracteres
APP_LOGIN_EMAIL=usuario@empresa.com
APP_LOGIN_PASSWORD=sua-senha
```

Para vários usuários, também é possível usar:

```env
APP_USERS_JSON=[{"email":"usuario1@empresa.com","password":"senha1"},{"email":"usuario2@empresa.com","password":"senha2"}]
```

`DATABASE_URL`, senhas e `SESSION_SECRET` são variáveis **de servidor**. Não use o prefixo `VITE_`.

## Banco

A estrutura necessária está em:

`SQL_NEON_SCHEMA.sql`

Se o script já foi executado no Neon, não é necessário importar dados antigos do Supabase. Basta publicar o sistema e importar novamente o Excel.

## Regras preservadas

- Uma OP consolidada por número de OP.
- Soma da quantidade quando uma OP aparece mais de uma vez no Excel.
- Menor série inicial e maior série final.
- Preservação de marcações de OPs que continuam existindo após nova importação.
- Exclusão de OPs do banco quando elas deixam de existir no Excel importado.
- Pesquisa por OP e intervalo de série.
- Registro de usuário e data de marcação.
- Ranking de marcações por período.

## Desenvolvimento

O frontend pode ser compilado com:

```bash
npm install
npm run lint
npm run build
```

Para testar as funções `/api/*` localmente, use o ambiente do Vercel (`vercel dev`) com as variáveis de ambiente configuradas.
