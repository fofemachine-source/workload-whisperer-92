
-- 1) Novas colunas em producao_diaria
ALTER TABLE public.producao_diaria
  ADD COLUMN IF NOT EXISTS producao_mina numeric,
  ADD COLUMN IF NOT EXISTS producao_retaludamento numeric,
  ADD COLUMN IF NOT EXISTS acumulado_mes numeric,
  ADD COLUMN IF NOT EXISTS meta_diaria numeric,
  ADD COLUMN IF NOT EXISTS meta_mensal numeric,
  ADD COLUMN IF NOT EXISTS projecao_turno numeric;

-- 2) Produção por Frente (N4WN, N4WS, MORRO1, N5SUL, ...)
CREATE TABLE IF NOT EXISTS public.producao_frente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text NOT NULL,
  relatorio_origem text NOT NULL,
  frente text NOT NULL,
  toneladas numeric NOT NULL DEFAULT 0,
  producao_hora numeric,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, turno, relatorio_origem, frente)
);
GRANT SELECT ON public.producao_frente TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_frente TO authenticated;
GRANT ALL ON public.producao_frente TO service_role;
ALTER TABLE public.producao_frente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública produção frente"
  ON public.producao_frente FOR SELECT USING (true);
CREATE POLICY "Service role grava produção frente"
  ON public.producao_frente FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Produção por Equipamento (Ranking EH)
CREATE TABLE IF NOT EXISTS public.producao_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text NOT NULL,
  relatorio_origem text NOT NULL,
  equipamento text NOT NULL,
  tipo text,
  toneladas numeric NOT NULL DEFAULT 0,
  producao_hora numeric,
  df numeric,
  ut numeric,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, turno, relatorio_origem, equipamento)
);
GRANT SELECT ON public.producao_equipamento TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_equipamento TO authenticated;
GRANT ALL ON public.producao_equipamento TO service_role;
ALTER TABLE public.producao_equipamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública produção equipamento"
  ON public.producao_equipamento FOR SELECT USING (true);
CREATE POLICY "Service role grava produção equipamento"
  ON public.producao_equipamento FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4) Realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_frente;
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_equipamento;
