-- ============================================
-- 1) producao_diaria
-- ============================================
CREATE TABLE public.producao_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia date NOT NULL,
  turno text,
  relatorio_origem text NOT NULL DEFAULT 'producao_diaria',
  toneladas_total numeric,
  producao_hora numeric,
  disponibilidade_fisica_df numeric,
  utilizacao_ut numeric,
  equipamentos_disponiveis integer,
  equipamentos_utilizados integer,
  carga_operando integer,
  transporte_operando integer,
  payload_bruto jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (data_referencia, turno, relatorio_origem)
);
CREATE INDEX idx_producao_diaria_data ON public.producao_diaria (data_referencia DESC);
CREATE INDEX idx_producao_diaria_relatorio ON public.producao_diaria (relatorio_origem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producao_diaria TO authenticated;
GRANT ALL ON public.producao_diaria TO service_role;
ALTER TABLE public.producao_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read producao_diaria" ON public.producao_diaria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage producao_diaria" ON public.producao_diaria FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2) sincronizacao_ssrs (logs)
-- ============================================
CREATE TABLE public.sincronizacao_ssrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio text NOT NULL,
  status text NOT NULL CHECK (status IN ('sucesso','erro','parcial')),
  registros_recebidos integer NOT NULL DEFAULT 0,
  registros_inseridos integer NOT NULL DEFAULT 0,
  registros_atualizados integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  mensagem_erro text,
  agente_versao text,
  agente_host text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_ssrs_finalizado ON public.sincronizacao_ssrs (finalizado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sincronizacao_ssrs TO authenticated;
GRANT ALL ON public.sincronizacao_ssrs TO service_role;
ALTER TABLE public.sincronizacao_ssrs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sync" ON public.sincronizacao_ssrs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage sync" ON public.sincronizacao_ssrs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 3) agente_tokens (auth agente -> edge function)
-- ============================================
CREATE TABLE public.agente_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_uso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revogado_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agente_tokens TO authenticated;
GRANT ALL ON public.agente_tokens TO service_role;
ALTER TABLE public.agente_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage tokens" ON public.agente_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 4) ssrs_config (configuração admin)
-- ============================================
CREATE TABLE public.ssrs_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ssrs_url text NOT NULL,
  ssrs_username text,
  caminho_relatorio text NOT NULL DEFAULT 'JMineOPS/Relatorios_HOMOLOGACAO/Producao Diaria',
  intervalo_sync_segundos integer NOT NULL DEFAULT 300,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ssrs_config TO authenticated;
GRANT ALL ON public.ssrs_config TO service_role;
ALTER TABLE public.ssrs_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage config" ON public.ssrs_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ssrs_config_updated
BEFORE UPDATE ON public.ssrs_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_producao_diaria_updated
BEFORE UPDATE ON public.producao_diaria
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.producao_diaria;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sincronizacao_ssrs;

-- Seed config padrão
INSERT INTO public.ssrs_config (ssrs_url, ssrs_username, caminho_relatorio, intervalo_sync_segundos)
VALUES ('http://192.168.17.15/ReportServer', '', 'JMineOPS/Relatorios_HOMOLOGACAO/Producao Diaria', 300);