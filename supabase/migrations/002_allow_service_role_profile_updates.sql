-- Permite que npm run user:* asigne el rol admin con la clave secret.
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
  return new;
end;
$$;
