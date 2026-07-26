
-- Helper: strip common date patterns from a title.
CREATE OR REPLACE FUNCTION public._strip_dates(t text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  months text := '(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)';
  s text := coalesce(t, '');
BEGIN
  s := regexp_replace(s, '\d{1,2}(st|nd|rd|th)?\s+' || months || '\s+\d{2,4}', ' ', 'gi');
  s := regexp_replace(s, months || '\s+\d{1,2}(st|nd|rd|th)?[,\s]+\d{2,4}', ' ', 'gi');
  s := regexp_replace(s, '\d{1,2}(st|nd|rd|th)?\s+' || months, ' ', 'gi');
  s := regexp_replace(s, months || '\s+\d{2,4}', ' ', 'gi');
  s := regexp_replace(s, '\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', ' ', 'g');
  s := regexp_replace(s, '\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}', ' ', 'g');
  s := regexp_replace(s, '\s+', ' ', 'g');
  s := regexp_replace(s, '(-|–|—)\s+(-|–|—)', '\1', 'g');
  s := regexp_replace(s, '(-|–|—)\s*(-|–|—)', '\1', 'g');
  s := regexp_replace(s, '^[\s\-–—,.:;]+', '', '');
  s := regexp_replace(s, '[\s\-–—,.:;]+$', '', '');
  RETURN btrim(s);
END $$;

-- 1) Rename existing reports to their cleaned title.
UPDATE public.reports
SET name = public._strip_dates(name)
WHERE public._strip_dates(name) IS DISTINCT FROM name
  AND length(public._strip_dates(name)) > 0;

-- 2) Merge duplicate reports (same category + cleaned name, case-insensitive).
--    Keep the earliest-created report as the canonical one; move sessions from
--    the others into it, then delete the duplicates.
WITH ranked AS (
  SELECT
    id,
    category,
    lower(btrim(name)) AS key,
    created_at,
    row_number() OVER (
      PARTITION BY category, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY category, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM public.reports
),
dupes AS (
  SELECT id, canonical_id FROM ranked WHERE rn > 1
)
UPDATE public.sessions s
SET report_id = d.canonical_id
FROM dupes d
WHERE s.report_id = d.id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY category, lower(btrim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.reports
)
DELETE FROM public.reports r
USING ranked
WHERE r.id = ranked.id AND ranked.rn > 1;
