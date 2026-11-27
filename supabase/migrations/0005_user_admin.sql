-- 0005_user_admin: a Super Admin can change another user's display name and role.
-- No column grant or policy on profiles changes: users still cannot write role_id. The change
-- goes through one security definer function that checks the caller first.

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role_id = '30000000-0000-0000-0000-000000000003'
  );
$$;

create function public.admin_update_profile(p_user_id uuid, p_display_name text, p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(trim(p_display_name), '');
begin
  if not (select public.is_super_admin()) then
    raise exception 'only a Super Admin can update a user' using errcode = '42501';
  end if;

  if char_length(v_name) > 100 then
    raise exception 'display name must be 100 characters or fewer' using errcode = '22023';
  end if;

  -- A Super Admin cannot change their own role, so at least one Super Admin always exists.
  if p_user_id = (select auth.uid())
     and p_role_id is distinct from (select role_id from public.profiles where id = p_user_id) then
    raise exception 'a Super Admin cannot change their own role' using errcode = '22023';
  end if;

  update public.profiles
  set display_name = v_name, role_id = p_role_id
  where id = p_user_id;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.admin_update_profile(uuid, text, uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_update_profile(uuid, text, uuid) to authenticated;
