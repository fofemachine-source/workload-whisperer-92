REVOKE ALL ON public.sync_logs FROM anon;
CREATE POLICY "Deny anonymous access to sync_logs"
ON public.sync_logs
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);