-- NOVO MODELO CONTROLE OP
-- Execute no SQL Editor do Supabase apenas se quiser garantir/backfill no banco.

ALTER TABLE registro_op
ADD COLUMN IF NOT EXISTS serie_inicial numeric,
ADD COLUMN IF NOT EXISTS serie_final numeric,
ADD COLUMN IF NOT EXISTS serie text,
ADD COLUMN IF NOT EXISTS marcado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_marcacao timestamptz,
ADD COLUMN IF NOT EXISTS usuario_marcacao text;

-- Converte registros antigos para a nova regra:
-- impresso/recolhido => marcado = true
UPDATE registro_op
SET
  marcado = true,
  data_marcacao = COALESCE(
    data_marcacao,
    CASE
      WHEN status = 'recolhido' THEN COALESCE(data_recolhimento, data_impressao)
      WHEN status = 'impresso' THEN COALESCE(data_impressao, data_recolhimento)
      ELSE data_marcacao
    END
  ),
  usuario_marcacao = COALESCE(
    usuario_marcacao,
    CASE
      WHEN status = 'recolhido' THEN COALESCE(usuario_recolhimento, usuario_impressao)
      WHEN status = 'impresso' THEN COALESCE(usuario_impressao, usuario_recolhimento)
      ELSE usuario_marcacao
    END
  )
WHERE status IN ('impresso', 'recolhido');

-- Garante que pendentes fiquem como não marcados quando ainda não tiverem valor.
UPDATE registro_op
SET
  marcado = false,
  data_marcacao = null,
  usuario_marcacao = null
WHERE status = 'pendente_impressao'
  AND (marcado IS NULL OR marcado = false);
