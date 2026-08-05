CREATE TABLE public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  blurb text NOT NULL DEFAULT '',
  tokens jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read programs" ON public.programs
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER programs_set_updated_at BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.programs (code, label, blurb, tokens, sort_order) VALUES
  ('MBA', 'MBA', 'Master of Business Administration attendance reports.', '["MBA"]'::jsonb, 1),
  ('PDBA', 'PDBA', 'Postgraduate Diploma in Business Admin attendance reports.', '["PDBA"]'::jsonb, 2),
  ('MMM', 'MMM', 'Master of Management (MMM) attendance reports.', '["MMM"]'::jsonb, 3),
  ('MBA_PDBA', 'MBA & PDBA', 'Combined MBA & PDBA sessions in a single report.', '["MBA","PDBA"]'::jsonb, 4);

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_category_check;