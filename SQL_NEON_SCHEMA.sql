-- Controle de OP - estrutura do banco Neon PostgreSQL
-- Pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS registro_op (
    id BIGSERIAL PRIMARY KEY,
    op TEXT NOT NULL UNIQUE,
    data_programada DATE,
    codigo_produto TEXT,
    potencia TEXT,
    linha TEXT,
    cliente TEXT,
    qtde NUMERIC DEFAULT 0,
    setor TEXT,
    status TEXT DEFAULT 'pendente_impressao'
        CHECK (status IN ('pendente_impressao', 'impresso', 'recolhido')),
    chave_importacao TEXT,
    serie_inicial NUMERIC,
    serie_final NUMERIC,
    serie TEXT,
    marcado BOOLEAN NOT NULL DEFAULT FALSE,
    data_marcacao TIMESTAMPTZ,
    usuario_marcacao TEXT,
    data_impressao TIMESTAMPTZ,
    usuario_impressao TEXT,
    data_recolhimento TIMESTAMPTZ,
    usuario_recolhimento TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registro_op_data_programada ON registro_op (data_programada);
CREATE INDEX IF NOT EXISTS idx_registro_op_setor ON registro_op (setor);
CREATE INDEX IF NOT EXISTS idx_registro_op_linha ON registro_op (linha);
CREATE INDEX IF NOT EXISTS idx_registro_op_cliente ON registro_op (cliente);
CREATE INDEX IF NOT EXISTS idx_registro_op_marcado ON registro_op (marcado);
CREATE INDEX IF NOT EXISTS idx_registro_op_serie_inicial ON registro_op (serie_inicial);
CREATE INDEX IF NOT EXISTS idx_registro_op_serie_final ON registro_op (serie_final);

CREATE OR REPLACE FUNCTION atualizar_timestamp_registro_op()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualizar_registro_op ON registro_op;
CREATE TRIGGER trg_atualizar_registro_op
BEFORE UPDATE ON registro_op
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp_registro_op();
