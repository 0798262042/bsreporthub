REVOKE ALL ON public.site_settings, public.site_drafts, public.site_versions FROM anon, authenticated;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT SELECT ON public.site_drafts, public.site_versions TO authenticated;
GRANT ALL ON public.site_settings, public.site_drafts, public.site_versions TO service_role;