# Alterações — Importação transparente

## Objetivo
Melhorar a visibilidade do processo de importação do Excel e da sincronização com o Supabase.

## Alterações aplicadas

### 1. Modal de progresso da importação
Após selecionar o Excel, o sistema exibe uma janela com as etapas:

1. Lendo arquivo Excel
2. Validando dados
3. Comparando OPs
4. Atualizando banco de dados
5. Finalizando importação

Cada etapa apresenta status visual: pendente, processando, concluído ou erro.

### 2. Barra de progresso geral
Foi adicionada uma barra percentual para indicar o avanço da importação.

### 3. Resumo final da sincronização
Ao finalizar, o sistema mostra:

- Linhas lidas do Excel
- Linhas válidas
- OPs únicas sincronizadas
- Marcações preservadas
- OPs adicionadas
- OPs atualizadas
- OPs removidas
- OPs duplicadas apagadas

### 4. Detalhamento por OP
O resumo também lista amostras de:

- OPs adicionadas
- OPs atualizadas
- OPs removidas por não estarem mais no Excel
- OPs duplicadas removidas
- OPs que mantiveram a marcação

## Regra preservada
A sincronização continua usando somente o número da OP como chave.

- OP existe no Excel e não existe no Supabase: adiciona
- OP existe nos dois: atualiza dados e preserva marcação
- OP existe no Supabase e não existe no Excel: remove

