DROP POLICY IF EXISTS "Deny all authenticated access" ON public.ssrs_config;
CREATE POLICY "Deny all authenticated access" ON public.ssrs_config AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all authenticated access" ON public.sincronizacao_ssrs;
CREATE POLICY "Deny all authenticated access" ON public.sincronizacao_ssrs AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);