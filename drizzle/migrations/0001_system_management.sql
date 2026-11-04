CREATE TABLE public.site_settings (id text PRIMARY KEY DEFAULT 'website', content jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, CONSTRAINT site_settings_singleton CHECK (id = 'website'));
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published website settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.site_drafts (id text PRIMARY KEY DEFAULT 'website', content jsonb NOT NULL DEFAULT '{}'::jsonb, revision integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, CONSTRAINT site_drafts_singleton CHECK (id = 'website'));
GRANT SELECT ON public.site_drafts TO authenticated;
GRANT ALL ON public.site_drafts TO service_role;
ALTER TABLE public.site_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved admins read drafts" ON public.site_drafts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.is_approved(auth.uid()));
CREATE TABLE public.site_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content jsonb NOT NULL, published_at timestamptz NOT NULL DEFAULT now(), published_by uuid);
GRANT SELECT ON public.site_versions TO authenticated;
GRANT ALL ON public.site_versions TO service_role;
ALTER TABLE public.site_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved admins read versions" ON public.site_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND public.is_approved(auth.uid()));
CREATE FUNCTION public.manage_site_content(_action text, _content jsonb, _revision integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_revision integer; next_revision integer;
BEGIN
IF NOT public.has_role(auth.uid(), 'admin') OR NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
PERFORM pg_advisory_xact_lock(730491);
SELECT revision INTO current_revision FROM public.site_drafts WHERE id = 'website';
current_revision := COALESCE(current_revision, 0);
IF _revision <> current_revision THEN RAISE EXCEPTION 'Settings changed by another administrator. Reload before saving.'; END IF;
IF _action NOT IN ('save', 'publish', 'restore') THEN RAISE EXCEPTION 'Invalid action'; END IF;
next_revision := current_revision + 1;
INSERT INTO public.site_drafts (id,content,revision,updated_by) VALUES ('website',_content,next_revision,auth.uid()) ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=now();
IF _action IN ('publish','restore') THEN
INSERT INTO public.site_versions(content,published_by) SELECT content,updated_by FROM public.site_settings WHERE id='website' AND NOT EXISTS (SELECT 1 FROM public.site_versions);
INSERT INTO public.site_settings(id,content,updated_by) VALUES ('website',_content,auth.uid()) ON CONFLICT (id) DO UPDATE SET content=EXCLUDED.content,updated_by=EXCLUDED.updated_by,updated_at=now();
INSERT INTO public.site_versions(content,published_by) VALUES (_content,auth.uid());
END IF;
INSERT INTO public.activity_logs(user_id,user_email,user_name,user_role,action,resource_type,resource_id,details) SELECT auth.uid(),email,trim(first_name || ' ' || last_name),'admin','system.' || _action,'website','website',jsonb_build_object('revision',next_revision) FROM public.profiles WHERE id=auth.uid();
RETURN next_revision;
END $$;
REVOKE ALL ON FUNCTION public.manage_site_content(text,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_site_content(text,jsonb,integer) TO authenticated;
CREATE POLICY "Admins read site media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='site-media' AND public.has_role(auth.uid(),'admin') AND public.is_approved(auth.uid()));
CREATE POLICY "Admins upload site media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='site-media' AND public.has_role(auth.uid(),'admin') AND public.is_approved(auth.uid()));