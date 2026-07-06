
-- Restrict anon SELECT on operational tables; keep authenticated + service_role.
DROP POLICY IF EXISTS "Anon read producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Anon read producao_equipamento" ON public.producao_equipamento;
DROP POLICY IF EXISTS "Anon read producao_frente" ON public.producao_frente;

DROP POLICY IF EXISTS "producao_view leitura publica" ON public.producao_view;
CREATE POLICY "producao_view leitura autenticada" ON public.producao_view FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sync_logs leitura pública" ON public.sync_logs;
CREATE POLICY "sync_logs leitura autenticada" ON public.sync_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tempo_ciclo leitura publica" ON public.tempo_ciclo;
CREATE POLICY "tempo_ciclo leitura autenticada" ON public.tempo_ciclo FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tempo_det leitura publica" ON public.tempo_detalhado;
CREATE POLICY "tempo_detalhado leitura autenticada" ON public.tempo_detalhado FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tempo_estado leitura publica" ON public.tempo_estado;
CREATE POLICY "tempo_estado leitura autenticada" ON public.tempo_estado FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "viagens leitura publica" ON public.viagens_acompanhamento;
CREATE POLICY "viagens leitura autenticada" ON public.viagens_acompanhamento FOR SELECT TO authenticated USING (true);

-- Revoke anon SELECT so the Data API cannot expose these tables without login.
REVOKE SELECT ON public.producao_diaria FROM anon;
REVOKE SELECT ON public.producao_equipamento FROM anon;
REVOKE SELECT ON public.producao_frente FROM anon;
REVOKE SELECT ON public.producao_view FROM anon;
REVOKE SELECT ON public.sync_logs FROM anon;
REVOKE SELECT ON public.tempo_ciclo FROM anon;
REVOKE SELECT ON public.tempo_detalhado FROM anon;
REVOKE SELECT ON public.tempo_estado FROM anon;
REVOKE SELECT ON public.viagens_acompanhamento FROM anon;

-- Storage: restrict update/delete of the spreadsheets bucket to authenticated users.
DROP POLICY IF EXISTS "Public update spreadsheets" ON storage.objects;
DROP POLICY IF EXISTS "Public delete spreadsheets" ON storage.objects;

CREATE POLICY "Authenticated update spreadsheets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'spreadsheets')
  WITH CHECK (bucket_id = 'spreadsheets');

CREATE POLICY "Authenticated delete spreadsheets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'spreadsheets');
