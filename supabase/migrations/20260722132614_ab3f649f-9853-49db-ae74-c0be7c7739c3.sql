-- Restrict deletes on reports and sessions to admins only
DROP POLICY IF EXISTS "Authenticated delete reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated delete sessions" ON public.sessions;

CREATE POLICY "Admins can delete reports"
ON public.reports FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sessions"
ON public.sessions FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));