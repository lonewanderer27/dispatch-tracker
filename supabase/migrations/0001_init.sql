-- 0001_init: profiles, todos, RLS, realtime.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger on auth.users insert
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);

-- Admin helper. security definer so policies can ask "is the caller an admin"
-- without recursing through profiles RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- todos
-- ---------------------------------------------------------------------------
create table public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 200),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index todos_user_id_idx on public.todos (user_id);

-- ---------------------------------------------------------------------------
-- RLS: enabled on every table, deny by default
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.todos    enable row level security;

-- Start from zero: no anon access at all, authenticated gets only what is granted below.
revoke all on public.profiles from anon, authenticated;
revoke all on public.todos    from anon, authenticated;

grant select                 on public.profiles to authenticated;
grant update (display_name)  on public.profiles to authenticated;  -- role is NOT updatable by users
grant select, insert, update, delete on public.todos to authenticated;

-- profiles: own row only; admins can read everyone
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_admin_select
  on public.profiles for select to authenticated
  using ((select public.is_admin()));

-- todos: CRUD only on own rows; admins get override
create policy todos_select_own
  on public.todos for select to authenticated
  using (user_id = (select auth.uid()));

create policy todos_insert_own
  on public.todos for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy todos_update_own
  on public.todos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy todos_delete_own
  on public.todos for delete to authenticated
  using (user_id = (select auth.uid()));

create policy todos_admin_all
  on public.todos for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Realtime: broadcast todo changes (RLS still filters the events)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.todos;
