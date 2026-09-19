-- Usuario de inicio de sesión (no correo). Auth de Supabase sigue
-- necesitando un email interno: se guarda como usuario@vivienda.local.

alter table public.profiles
  add column if not exists username text;

update public.profiles as profile
set username = lower(split_part(auth_user.email, '@', 1))
from auth.users as auth_user
where auth_user.id = profile.id
  and profile.username is null
  and coalesce(auth_user.email, '') <> '';

update public.profiles
set username = 'usuario-' || substr(id::text, 1, 8)
where username is null
  or btrim(username) = ''
  or username !~ '^[a-z][a-z0-9_-]{1,31}$';

with numbered as (
  select
    id,
    username,
    row_number() over (partition by username order by created_at, id) as n
  from public.profiles
)
update public.profiles as profile
set username = 'u' || substr(replace(profile.id::text, '-', ''), 1, 31)
from numbered
where numbered.id = profile.id
  and numbered.n > 1;

alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_key
  on public.profiles (username);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_chk
      check (username ~ '^[a-z][a-z0-9_-]{1,31}$');
  end if;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text;
begin
  chosen := nullif(lower(new.raw_user_meta_data ->> 'username'), '');
  if chosen is null or chosen = '' then
    chosen := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;
  if chosen is null or chosen = '' or chosen !~ '^[a-z][a-z0-9_-]{1,31}$' then
    chosen := 'u' || substr(replace(new.id::text, '-', ''), 1, 31);
  end if;

  insert into public.profiles (id, full_name, role, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', chosen, 'Usuario'),
    'floor_user',
    chosen
  );
  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if not public.is_admin() and new.role is distinct from old.role then
    raise exception 'No se puede cambiar el rol';
  end if;
  if not public.is_admin() and new.username is distinct from old.username then
    raise exception 'No se puede cambiar el usuario';
  end if;
  return new;
end;
$$;

create or replace function public.auth_email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select auth_user.email
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  where profile.username = lower(btrim(p_username))
  limit 1;
$$;

revoke all on function public.auth_email_for_username(text) from public;
grant execute on function public.auth_email_for_username(text) to anon, authenticated, service_role;
