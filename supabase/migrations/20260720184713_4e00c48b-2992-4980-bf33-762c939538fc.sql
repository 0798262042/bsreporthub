
-- 1. Add owner tracking to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill existing rows to the first admin
UPDATE public.reports
SET owner_id = (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)
WHERE owner_id IS NULL;

-- Auto-set owner_id on insert if not provided
CREATE OR REPLACE FUNCTION public.set_report_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_set_owner ON public.reports;
CREATE TRIGGER reports_set_owner
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_report_owner();

-- 2. Rewrite reports policies
DROP POLICY IF EXISTS "Admin delete reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated insert reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated read reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated update reports" ON public.reports;

CREATE POLICY "Owners and admins read reports"
ON public.reports FOR SELECT TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert own reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Owners and admins update reports"
ON public.reports FOR UPDATE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners and admins delete reports"
ON public.reports FOR DELETE TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- 3. Rewrite sessions policies to inherit from parent report
DROP POLICY IF EXISTS "Admin or self delete sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated read sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated update sessions" ON public.sessions;

CREATE POLICY "Read sessions of owned reports"
ON public.sessions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = sessions.report_id
      AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Insert sessions into owned reports"
ON public.sessions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = sessions.report_id
      AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Update sessions of owned reports"
ON public.sessions FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = sessions.report_id
      AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = sessions.report_id
      AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Delete sessions of owned reports"
ON public.sessions FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = sessions.report_id
      AND (r.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- 4. Lock down SECURITY DEFINER helpers from anon
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role must remain callable by authenticated so it can be evaluated inside RLS policies.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
