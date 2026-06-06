
-- 1) Explicit deny for anon on sensitive tables
CREATE POLICY "Deny all anon access" ON public.agente_tokens AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access" ON public.sincronizacao_ssrs AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny all anon access" ON public.ssrs_config AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- 2) Restrict writes on operational tables to service_role only (reads stay for authenticated)
DROP POLICY IF EXISTS "Auth manage daily_production" ON public.daily_production;
DROP POLICY IF EXISTS "Auth manage producao_diaria" ON public.producao_diaria;
DROP POLICY IF EXISTS "Auth manage planned_production" ON public.planned_production;
DROP POLICY IF EXISTS "Auth manage locations" ON public.locations;
DROP POLICY IF EXISTS "Auth manage equipment" ON public.equipment;
DROP POLICY IF EXISTS "Auth manage occurrences" ON public.occurrences;

CREATE POLICY "Service role manage daily_production" ON public.daily_production FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage producao_diaria" ON public.producao_diaria FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage planned_production" ON public.planned_production FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage locations" ON public.locations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage equipment" ON public.equipment FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role manage occurrences" ON public.occurrences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3) Restrict spreadsheet_uploads to service_role (was public insert/select)
DROP POLICY IF EXISTS "Public insert uploads" ON public.spreadsheet_uploads;
DROP POLICY IF EXISTS "Public read uploads" ON public.spreadsheet_uploads;
CREATE POLICY "Service role manage spreadsheet_uploads" ON public.spreadsheet_uploads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Auth read spreadsheet_uploads" ON public.spreadsheet_uploads FOR SELECT TO authenticated USING (true);
