# Controle de OP — Neon

Versão migrada do Supabase para **Neon PostgreSQL**, com autenticação multiusuário no próprio Neon.

## Arquitetura

- Frontend: React + Vite + TypeScript + Tailwind.
- Backend: funções serverless `/api/*` no Vercel.
- Banco: Neon PostgreSQL usando `DATABASE_URL` somente no servidor.
- Login: sessão HTTP-only assinada no servidor.
- Usuários: armazenados na tabela `usuarios` do Neon, com senha protegida por hash usando `pgcrypto`.
- Atualização entre usuários: atualização automática do painel a cada 30 segundos, além das atualizações imediatas após importação e marcação.

## Variáveis no Vercel

Configure em **Project > Settings > Environment Variables**:

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=uma-chave-aleatoria-com-pelo-menos-32-caracteres
```

As variáveis abaixo são opcionais e podem ser mantidas como login administrativo de contingência:

```env
APP_LOGIN_EMAIL=usuario@empresa.com
APP_LOGIN_PASSWORD=sua-senha
```

`DATABASE_URL`, senhas e `SESSION_SECRET` são variáveis **de servidor**. Não use o prefixo `VITE_`.

## Usuários

A estrutura da tabela `usuarios` e os comandos para criar/alterar usuários devem ser executados diretamente no SQL Editor do Neon. Eles não fazem parte deste pacote.

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

```bash
npm install
npm run lint
npm run build
```

Para testar as funções `/api/*` localmente, use `vercel dev` com as variáveis de ambiente configuradas.
