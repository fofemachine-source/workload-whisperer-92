
-- Remove sincronizacao_ssrs from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.sincronizacao_ssrs;

-- agente_tokens: lock down to service_role only
DROP POLICY IF EXISTS "Auth manage tokens" ON public.agente_tokens;
REVOKE ALL ON public.agente_tokens FROM anon, authenticated;
CREATE POLICY "Deny all authenticated access" ON public.agente_tokens
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ssrs_config: lock down to service_role only
DROP POLICY IF EXISTS "Auth manage config" ON public.ssrs_config;
REVOKE ALL ON public.ssrs_config FROM anon, authenticated;
CREATE POLICY "Deny all authenticated access" ON public.ssrs_config
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- sincronizacao_ssrs: lock down to service_role only
DROP POLICY IF EXISTS "Auth read sync" ON public.sincronizacao_ssrs;
DROP POLICY IF EXISTS "Auth manage sync" ON public.sincronizacao_ssrs;
REVOKE ALL ON public.sincronizacao_ssrs FROM anon, authenticated;
CREATE POLICY "Deny all authenticated access" ON public.sincronizacao_ssrs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
