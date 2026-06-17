-- Make service_role access explicit on ssrs_config so the access model is unambiguous.
-- (service_role bypasses RLS anyway, but an explicit PERMISSIVE policy documents the intent
-- alongside the existing RESTRICTIVE deny policies for anon and authenticated.)
DROP POLICY IF EXISTS "Service role full access" ON public.ssrs_config;
CREATE POLICY "Service role full access"
  ON public.ssrs_config
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);