-- Keep member-facing announcement access precise while avoiding duplicate
-- permissive SELECT policies for authenticated users.

drop policy if exists "Authorized users can manage announcements"
on public.portal_announcements;

create policy "Authorized users can create announcements"
on public.portal_announcements
for insert
to authenticated
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Authorized users can update announcements"
on public.portal_announcements
for update
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
)
with check (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);

create policy "Authorized users can delete announcements"
on public.portal_announcements
for delete
to authenticated
using (
  public.has_chapter_permission(organization_id, 'settings.manage')
  or public.has_chapter_permission(organization_id, 'all')
);
