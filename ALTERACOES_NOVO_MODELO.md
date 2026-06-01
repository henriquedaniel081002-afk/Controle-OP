# Alterações aplicadas — Novo Modelo Controle OP

## Layout

- Removidos os cards superiores.
- Removidos os filtros avançados.
- Removidos os botões de marcação em massa.
- Mantido o cabeçalho com usuário, importação de Excel e sair.
- Mantido o campo de busca.
- Adicionado seletor de mês.
- Adicionado filtro simples: Todos | Pendentes | Marcados.
- Tabela reorganizada por semanas do mês.
- Cada semana exibe: total de OPs, quantidade marcada e percentual marcado.

## Regra de OP única

- Cada OP aparece apenas uma vez no mês selecionado.
- A semana da OP é definida pela menor data programada da OP no mês.
- A tabela agrupa os registros internos por OP sem alterar a regra de sincronização do banco.

## Marcação

- Novo controle único por OP: marcado/pendente.
- Ao marcar, grava:
  - marcado = true
  - data_marcacao = data/hora atual
  - usuario_marcacao = usuário logado
- Ao desmarcar, limpa:
  - marcado = false
  - data_marcacao = null
  - usuario_marcacao = null

## Migração da regra antiga

- status = impresso vira marcado.
- status = recolhido vira marcado.
- status = pendente_impressao vira pendente.
- data_impressao/data_recolhimento são usadas para preencher data_marcacao quando existir histórico.

## Importação Excel

- Importador agora encontra automaticamente a linha de cabeçalho, mesmo quando o Excel vem com linhas iniciais de emissão/usuário/total.
- Adicionada leitura de:
  - Série Inicial
  - Série Final
- Grava no Supabase:
  - serie_inicial
  - serie_final
  - serie no formato 306165 - 306187

## Sincronização Excel x Supabase

A regra principal foi mantida:

- Se está no Excel e não está no Supabase: adiciona.
- Se está no Supabase e não está no Excel: remove.
- Se está nos dois: atualiza dados do Excel e preserva marcação.

Chave de sincronização mantida:

OP + data_programada + qtde + setor
