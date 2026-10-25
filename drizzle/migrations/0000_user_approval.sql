ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected','suspended'));

-- Existing accounts keep working: active -> approved, deactivated -> suspended.
UPDATE public.profiles SET approval_status = CASE WHEN is_active THEN 'approved' ELSE 'suspended' END,
  approved_at = COALESCE(approved_at, now());

-- Admins are always approved.
UPDATE public.profiles p SET approval_status = 'approved', is_active = true
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = _user_id AND approval_status = 'approved' AND is_active = true)
$$;
REVOKE EXECUTE ON FUNCTION public.is_approved(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated;

-- Users cannot change their own approval fields; only service role (admin server code) can.
CREATE OR REPLACE FUNCTION public.protect_profile_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('authenticated','anon')
     OR coalesce((current_setting('request.jwt.claims', true)::jsonb ->> 'role'), '') IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending';
      NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.rejection_reason := NULL;
      NEW.is_active := true;
    ELSE
      NEW.approval_status := OLD.approval_status;
      NEW.approved_by := OLD.approved_by;
      NEW.approved_at := OLD.approved_at;
      NEW.rejection_reason := OLD.rejection_reason;
      NEW.status_changed_at := OLD.status_changed_at;
      NEW.is_active := OLD.is_active;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_approval ON public.profiles;
CREATE TRIGGER protect_profile_approval BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_approval();

-- New sign-ups: always standard user role, always pending (bootstrap admin approved).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE is_boot boolean := lower(NEW.email) = 'dericksethole@gmail.com';
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email, phone, department, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'department', ''),
    CASE WHEN is_boot THEN 'approved' ELSE 'pending' END,
    CASE WHEN is_boot THEN now() ELSE NULL END
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_boot THEN 'admin'::app_role ELSE 'user'::app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Enforce approval on shared data.
DROP POLICY IF EXISTS "Authenticated read all reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated update reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated insert reports" ON public.reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON public.reports;
CREATE POLICY "Approved read reports" ON public.reports FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved insert reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved update reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved admins delete reports" ON public.reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read all sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated update sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated insert sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins can delete sessions" ON public.sessions;
CREATE POLICY "Approved read sessions" ON public.sessions FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved insert sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved update sessions" ON public.sessions FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved admins delete sessions" ON public.sessions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') AND public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read programs" ON public.programs;
CREATE POLICY "Approved read programs" ON public.programs FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));