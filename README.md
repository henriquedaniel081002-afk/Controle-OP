# Controle de OP

Sistema web para controle operacional de OPs com login via Supabase Auth, importação de Excel, filtros, ordenação e atualização em tempo real.

## Ajustes incluídos nesta versão

- Login com e-mail e senha via Supabase Auth.
- Coluna **Data Programada** no painel principal.
- Importação do Excel lendo a coluna `Dt.Programada` e gravando no Supabase como `data_programada`.
- Conversão automática de datas para o formato `YYYY-MM-DD` antes de salvar no banco.
- Filtro por período usando data inicial e data final.
- Ordenação da tabela por qualquer coluna ao clicar no cabeçalho.

## Pré-requisito no Supabase

A tabela `registro_op` precisa ter a coluna abaixo:

```sql
ALTER TABLE registro_op
ADD COLUMN data_programada date;
```

Se a coluna já existir, não execute novamente.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
