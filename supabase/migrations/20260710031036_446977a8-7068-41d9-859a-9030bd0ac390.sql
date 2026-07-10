
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'MBA',
  ADD COLUMN IF NOT EXISTS hidden_names JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_category_check CHECK (category IN ('MBA','PDBA','MMM'));

CREATE INDEX IF NOT EXISTS reports_category_idx ON public.reports(category);
