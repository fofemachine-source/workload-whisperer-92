DROP POLICY IF EXISTS "Deny all authenticated access" ON public.agente_tokens;
CREATE POLICY "Deny all authenticated access" ON public.agente_tokens
AS RESTRICTIVE FOR ALL TO authenticated
USING (false) WITH CHECK (false);