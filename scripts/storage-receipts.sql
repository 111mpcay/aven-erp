-- Receipts Storage bucket + RLS policies (version-controlled).
-- Run with:  npm run db:storage   (executes this file over ADMIN_DATABASE_URL)
-- Idempotent: safe to re-run. Storage policies live in the `storage` schema and
-- are not managed by Drizzle migrations, so they are kept here as a committed,
-- repeatable script (the security model in src/lib/storage/receipts.ts and
-- src/app/(app)/expenses/receipt/route.ts depends on these being applied).
--
-- Isolation model: object path is `{company_id}/...`; the first path segment is
-- matched against the caller's company_members. Reads = any member; writes =
-- write-role members (owner/admin/accountant/encoder), mirroring table RLS.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_select_members" on storage.objects;
create policy "receipts_select_members"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select company_id::text from company_members
      where user_id = (select auth.uid())
    )
  );

drop policy if exists "receipts_insert_write_roles" on storage.objects;
create policy "receipts_insert_write_roles"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select company_id::text from company_members
      where user_id = (select auth.uid())
        and role in ('owner','admin','accountant','encoder')
    )
  );

drop policy if exists "receipts_update_write_roles" on storage.objects;
create policy "receipts_update_write_roles"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select company_id::text from company_members
      where user_id = (select auth.uid())
        and role in ('owner','admin','accountant','encoder')
    )
  );

drop policy if exists "receipts_delete_write_roles" on storage.objects;
create policy "receipts_delete_write_roles"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select company_id::text from company_members
      where user_id = (select auth.uid())
        and role in ('owner','admin','accountant','encoder')
    )
  );
