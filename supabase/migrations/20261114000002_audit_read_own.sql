-- Everyone sees their own activity on their profile; editors also see the team feed.
create policy audit_read_own on public.audit_logs for select to authenticated
  using (user_id = auth.uid() or public.is_editor());
