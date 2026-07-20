
DROP POLICY IF EXISTS "Owners and admins read reports" ON public.reports;
DROP POLICY IF EXISTS "Owners and admins update reports" ON public.reports;
DROP POLICY IF EXISTS "Owners and admins delete reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated insert own reports" ON public.reports;

CREATE POLICY "Authenticated read all reports" ON public.reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update reports" ON public.reports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete reports" ON public.reports
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Read sessions of owned reports" ON public.sessions;
DROP POLICY IF EXISTS "Insert sessions into owned reports" ON public.sessions;
DROP POLICY IF EXISTS "Update sessions of owned reports" ON public.sessions;
DROP POLICY IF EXISTS "Delete sessions of owned reports" ON public.sessions;

CREATE POLICY "Authenticated read all sessions" ON public.sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert sessions" ON public.sessions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update sessions" ON public.sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete sessions" ON public.sessions
  FOR DELETE TO authenticated USING (true);
