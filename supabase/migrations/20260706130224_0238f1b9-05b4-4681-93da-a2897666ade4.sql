
DROP POLICY IF EXISTS "Public upload spreadsheets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update spreadsheets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete spreadsheets" ON storage.objects;

CREATE POLICY "Authenticated upload spreadsheets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'spreadsheets' AND owner = auth.uid());

CREATE POLICY "Owners update spreadsheets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'spreadsheets' AND owner = auth.uid())
WITH CHECK (bucket_id = 'spreadsheets' AND owner = auth.uid());

CREATE POLICY "Owners delete spreadsheets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'spreadsheets' AND owner = auth.uid());
