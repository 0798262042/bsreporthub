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
