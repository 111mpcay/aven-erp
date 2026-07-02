-- Phase 5: member-management RLS (deferred from Phase 0) + co-member profiles.
--
-- Policies on company_members can't subquery company_members directly
-- (infinite recursion). is_company_admin() is SECURITY DEFINER owned by
-- postgres (BYPASSRLS on Supabase), so it reads memberships without
-- re-triggering RLS. STABLE so the planner caches it per-statement.
create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from company_members
    where company_id = target_company
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;--> statement-breakpoint
revoke all on function public.is_company_admin(uuid) from public;--> statement-breakpoint
grant execute on function public.is_company_admin(uuid) to authenticated;--> statement-breakpoint

-- Admins see and manage ALL memberships of their companies (members still see
-- their own rows via the Phase 0 company_members_select_self policy).
create policy "company_members_select_admin" on "company_members"
  as permissive for select to "authenticated"
  using (public.is_company_admin(company_id));--> statement-breakpoint
create policy "company_members_insert_admin" on "company_members"
  as permissive for insert to "authenticated"
  with check (public.is_company_admin(company_id));--> statement-breakpoint
create policy "company_members_update_admin" on "company_members"
  as permissive for update to "authenticated"
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));--> statement-breakpoint
create policy "company_members_delete_admin" on "company_members"
  as permissive for delete to "authenticated"
  using (public.is_company_admin(company_id));--> statement-breakpoint

-- Admins can read co-member profiles (names for the Team list + audit viewer).
create policy "profiles_select_company_admin" on "profiles"
  as permissive for select to "authenticated"
  using (exists (
    select 1 from company_members m
    where m.user_id = profiles.id and public.is_company_admin(m.company_id)
  ));