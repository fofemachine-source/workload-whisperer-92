
-- ============================================================
-- 5 tabelas espelhando as views do JMineOps/Hexagon
-- ============================================================

-- 1. producao_view  (custom_vw_producao)
CREATE TABLE public.producao_view (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  hora smallint,
  turno text,
  equipamento text,
  frota text,
  frente text,
  material text,
  toneladas numeric,
  cargas numeric,
  raw jsonb NOT NULL,
  raw_hash text NOT NULL,
  relatorio_origem text NOT NULL DEFAULT 'sqlserver-agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, raw_hash)
);
CREATE INDEX producao_view_data_idx ON public.producao_view (data_referencia DESC);
CREATE INDEX producao_view_equip_idx ON public.producao_view (equipamento);
GRANT SELECT ON public.producao_view TO anon, authenticated;
GRANT ALL ON public.producao_view TO service_role;
ALTER TABLE public.producao_view ENABLE ROW LEVEL SECURITY;
CREATE POLICY "producao_view leitura publica" ON public.producao_view FOR SELECT USING (true);
CREATE POLICY "producao_view escrita servico" ON public.producao_view FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. viagens_acompanhamento  (custom_vw_acompanhamento_viagens)
CREATE TABLE public.viagens_acompanhamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text,
  equipamento text,
  frota text,
  frente_origem text,
  frente_destino text,
  viagens integer,
  toneladas numeric,
  tempo_ciclo_min numeric,
  raw jsonb NOT NULL,
  raw_hash text NOT NULL,
  relatorio_origem text NOT NULL DEFAULT 'sqlserver-agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, raw_hash)
);
CREATE INDEX viagens_data_idx ON public.viagens_acompanhamento (data_referencia DESC);
CREATE INDEX viagens_equip_idx ON public.viagens_acompanhamento (equipamento);
GRANT SELECT ON public.viagens_acompanhamento TO anon, authenticated;
GRANT ALL ON public.viagens_acompanhamento TO service_role;
ALTER TABLE public.viagens_acompanhamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viagens leitura publica" ON public.viagens_acompanhamento FOR SELECT USING (true);
CREATE POLICY "viagens escrita servico" ON public.viagens_acompanhamento FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. tempo_estado  (custom_vw_tempo)
CREATE TABLE public.tempo_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text,
  equipamento text,
  frota text,
  estado text,
  minutos numeric,
  raw jsonb NOT NULL,
  raw_hash text NOT NULL,
  relatorio_origem text NOT NULL DEFAULT 'sqlserver-agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, raw_hash)
);
CREATE INDEX tempo_estado_data_idx ON public.tempo_estado (data_referencia DESC);
CREATE INDEX tempo_estado_equip_idx ON public.tempo_estado (equipamento);
GRANT SELECT ON public.tempo_estado TO anon, authenticated;
GRANT ALL ON public.tempo_estado TO service_role;
ALTER TABLE public.tempo_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tempo_estado leitura publica" ON public.tempo_estado FOR SELECT USING (true);
CREATE POLICY "tempo_estado escrita servico" ON public.tempo_estado FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. tempo_ciclo  (custom_vw_tempo_ciclo)
CREATE TABLE public.tempo_ciclo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text,
  equipamento text,
  frota text,
  frente text,
  ciclo_min numeric,
  viagens integer,
  raw jsonb NOT NULL,
  raw_hash text NOT NULL,
  relatorio_origem text NOT NULL DEFAULT 'sqlserver-agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, raw_hash)
);
CREATE INDEX tempo_ciclo_data_idx ON public.tempo_ciclo (data_referencia DESC);
CREATE INDEX tempo_ciclo_equip_idx ON public.tempo_ciclo (equipamento);
GRANT SELECT ON public.tempo_ciclo TO anon, authenticated;
GRANT ALL ON public.tempo_ciclo TO service_role;
ALTER TABLE public.tempo_ciclo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tempo_ciclo leitura publica" ON public.tempo_ciclo FOR SELECT USING (true);
CREATE POLICY "tempo_ciclo escrita servico" ON public.tempo_ciclo FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. tempo_detalhado  (custom_vw_tempo_detalhado)
CREATE TABLE public.tempo_detalhado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text,
  equipamento text,
  frota text,
  categoria text,
  sub_estado text,
  minutos numeric,
  raw jsonb NOT NULL,
  raw_hash text NOT NULL,
  relatorio_origem text NOT NULL DEFAULT 'sqlserver-agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, raw_hash)
);
CREATE INDEX tempo_det_data_idx ON public.tempo_detalhado (data_referencia DESC);
CREATE INDEX tempo_det_equip_idx ON public.tempo_detalhado (equipamento);
GRANT SELECT ON public.tempo_detalhado TO anon, authenticated;
GRANT ALL ON public.tempo_detalhado TO service_role;
ALTER TABLE public.tempo_detalhado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tempo_det leitura publica" ON public.tempo_detalhado FOR SELECT USING (true);
CREATE POLICY "tempo_det escrita servico" ON public.tempo_detalhado FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_view;
ALTER PUBLICATION supabase_realtime ADD TABLE public.viagens_acompanhamento;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tempo_estado;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tempo_ciclo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tempo_detalhado;
