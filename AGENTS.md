<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Account access is gated by profiles.approval_status via public.is_approved() in RLS on reports/sessions/programs; a trigger blocks users from changing their own approval fields, and only admin server functions (service role) change them. Why: approval must be enforced in the database, not just the UI.
- Student name indexing, rankings and individual histories run in a disposable browser worker using the same matching and unique-session logic; terminate it on navigation/data changes to release private datasets and keep inputs responsive.
- Website customisation uses private drafts and immutable published versions; an approved-admin RPC atomically publishes settings and audit entries with revision checks to prevent concurrent overwrites.
- Site media stays in private storage; public delivery serves only current published references, and server-side signature/size validation runs before settings are saved.
- Media upload success requires both storage and revision-checked draft persistence; publication updates the shared settings cache and other tabs, while media ETags revalidate publication before serving cached bytes.
- Attendance reads are paginated to completion; home reads category-only summaries and category pages scope datasets. Query caches are identity-scoped and removed on sign-out to prevent cross-account data reuse.
- Bulk Excel workbooks run in a disposable browser worker; per-report and student exporters load on demand to avoid downloading spreadsheet libraries during ordinary navigation.
- Attendance file decoding runs in one disposable browser worker per sequential upload, preserving existing validation/matching while keeping the interface responsive and bounding memory.
