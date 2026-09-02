# Migração Supabase -> Neon

Esta versão não migra os dados antigos. O fluxo esperado é:

1. Executar `SQL_NEON_SCHEMA.sql` no Neon.
2. Configurar `DATABASE_URL`, `SESSION_SECRET` e os usuários no Vercel.
3. Fazer deploy do projeto.
4. Entrar no sistema.
5. Importar novamente o Excel para popular `registro_op`.
6. Validar marcação, pesquisa e filtros.
7. Somente depois da validação, desativar/remover a estrutura antiga do Supabase.

## Segurança

A `DATABASE_URL` nunca é enviada ao navegador. Todo acesso ao Neon passa pelas funções serverless do Vercel.
