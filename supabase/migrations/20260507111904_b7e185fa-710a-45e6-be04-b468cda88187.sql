-- Storage bucket for spreadsheets (public read, public write per user choice)
INSERT INTO storage.buckets (id, name, public) VALUES ('spreadsheets', 'spreadsheets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Public read spreadsheets"
ON storage.objects FOR SELECT
USING (bucket_id = 'spreadsheets');

-- Public upload (anyone with the link)
CREATE POLICY "Public upload spreadsheets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'spreadsheets');

CREATE POLICY "Public update spreadsheets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'spreadsheets');

CREATE POLICY "Public delete spreadsheets"
ON storage.objects FOR DELETE
USING (bucket_id = 'spreadsheets');

-- Tracking table - latest uploaded spreadsheet
CREATE TABLE public.spreadsheet_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spreadsheet_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read uploads"
ON public.spreadsheet_uploads FOR SELECT
USING (true);

CREATE POLICY "Public insert uploads"
ON public.spreadsheet_uploads FOR INSERT
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.spreadsheet_uploads;
ALTER TABLE public.spreadsheet_uploads REPLICA IDENTITY FULL;