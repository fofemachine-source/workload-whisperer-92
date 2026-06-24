
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origem TEXT NOT NULL,
  status TEXT NOT NULL,
  mensagem TEXT,
  ultima_sincronizacao TIMESTAMPTZ,
  total_registros INTEGER DEFAULT 0,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sync_logs TO anon, authenticated;
GRANT ALL ON public.sync_logs TO service_role;

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_logs leitura pública"
  ON public.sync_logs FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS sync_logs_created_at_idx ON public.sync_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS sync_logs_origem_idx ON public.sync_logs (origem);
