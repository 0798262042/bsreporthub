
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  session_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  host_name TEXT,
  host_email TEXT,
  source_filename TEXT NOT NULL DEFAULT '',
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sessions_report_id_idx ON public.sessions(report_id);
CREATE UNIQUE INDEX sessions_report_fp_idx ON public.sessions(report_id, fingerprint);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO anon, authenticated;
GRANT ALL ON public.reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reports" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Public insert reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update reports" ON public.reports FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete reports" ON public.reports FOR DELETE USING (true);

CREATE POLICY "Public read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Public insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sessions" ON public.sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete sessions" ON public.sessions FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
