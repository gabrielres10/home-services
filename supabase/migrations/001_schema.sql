-- Vivienda: esquema inicial, RLS, almacenamiento y semilla.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'floor_user');
  end if;
  if not exists (select 1 from pg_type where typname = 'consumption_source') then
    create type public.consumption_source as enum ('metered', 'copied');
  end if;
  if not exists (select 1 from pg_type where typname = 'period_status') then
    create type public.period_status as enum ('open', 'ready', 'closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'reading_status') then
    create type public.reading_status as enum ('pending', 'approved', 'rejected');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'floor_user',
  created_at timestamptz not null default now()
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  occupant_name text not null,
  sort_order integer not null unique
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  consumption_source public.consumption_source not null,
  copied_from_service_id uuid references public.services (id),
  sort_order integer not null unique,
  constraint services_copied_from_chk check (
    (consumption_source = 'copied' and copied_from_service_id is not null)
    or (consumption_source = 'metered' and copied_from_service_id is null)
  )
);

create table if not exists public.floor_service_meters (
  floor_id uuid not null references public.floors (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (floor_id, service_id)
);

create table if not exists public.floor_memberships (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  floor_id uuid not null references public.floors (id) on delete restrict
);

create table if not exists public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date not null,
  ends_on date not null,
  status public.period_status not null default 'open',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint billing_periods_dates_chk check (starts_on <= ends_on)
);

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.billing_periods (id) on delete cascade,
  pdf_storage_path text,
  uploaded_by uuid references public.profiles (id),
  uploaded_at timestamptz,
  notes text
);

create table if not exists public.bill_service_totals (
  bill_id uuid not null references public.bills (id) on delete cascade,
  service_id uuid not null references public.services (id),
  total_consumption numeric(14, 3) not null check (total_consumption >= 0),
  primary key (bill_id, service_id)
);

create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.billing_periods (id) on delete cascade,
  floor_id uuid not null references public.floors (id),
  service_id uuid not null references public.services (id),
  submitted_value numeric(14, 3) not null check (submitted_value >= 0),
  submitted_by uuid not null references public.profiles (id),
  submitted_at timestamptz not null default now(),
  value numeric(14, 3) not null check (value >= 0),
  reading_date date not null,
  status public.reading_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  corrected_by uuid references public.profiles (id),
  corrected_at timestamptz,
  current_photo_id uuid,
  unique (period_id, floor_id, service_id),
  constraint meter_readings_has_meter_fk
    foreign key (floor_id, service_id)
    references public.floor_service_meters (floor_id, service_id)
);

create table if not exists public.reading_photos (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.meter_readings (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'meter_readings_current_photo_id_fkey'
  ) then
    alter table public.meter_readings
      add constraint meter_readings_current_photo_id_fkey
      foreign key (current_photo_id)
      references public.reading_photos (id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  occurred_at timestamptz not null default now(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_data jsonb,
  to_data jsonb
);

create index if not exists meter_readings_period_idx on public.meter_readings (period_id);
create index if not exists reading_photos_reading_idx on public.reading_photos (reading_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists billing_periods_dates_idx on public.billing_periods (starts_on, ends_on);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.user_floor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select floor_id
  from public.floor_memberships
  where user_id = auth.uid();
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Usuario'),
    'floor_user'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Los comandos locales usan la clave secret/service_role; no hay auth.uid().
  if auth.role() = 'service_role' then
    return new;
  end if;
  if not public.is_admin() and new.role is distinct from old.role then
    raise exception 'No se puede cambiar el rol';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_privilege_escalation on public.profiles;
create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_escalation();

create or replace function public.audit_meter_reading_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (auth.uid(), 'meter_reading', new.id, 'reading.submitted', null, to_jsonb(new));
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'approved' then
    action_name := 'reading.approved';
  elsif old.status is distinct from new.status and new.status = 'rejected' then
    action_name := 'reading.rejected';
  elsif old.status is distinct from new.status and new.status = 'pending' then
    action_name := 'reading.resubmitted';
  elsif old.value is distinct from new.value then
    action_name := 'reading.corrected';
  else
    action_name := 'reading.updated';
  end if;

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
  values (auth.uid(), 'meter_reading', new.id, action_name, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists trg_audit_meter_readings on public.meter_readings;
create trigger trg_audit_meter_readings
  after insert or update on public.meter_readings
  for each row execute procedure public.audit_meter_reading_change();

create or replace function public.audit_bill_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (auth.uid(), 'bill', new.id, 'bill.created', null, to_jsonb(new));
    return new;
  end if;

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
  values (auth.uid(), 'bill', new.id, 'bill.updated', to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists trg_audit_bills on public.bills;
create trigger trg_audit_bills
  after insert or update on public.bills
  for each row execute procedure public.audit_bill_change();

create or replace function public.audit_period_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (auth.uid(), 'billing_period', new.id, 'period.created', null, to_jsonb(new));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (auth.uid(), 'billing_period', new.id, 'period.status_changed', to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_periods on public.billing_periods;
create trigger trg_audit_periods
  after insert or update on public.billing_periods
  for each row execute procedure public.audit_period_change();

alter table public.profiles enable row level security;
alter table public.floors enable row level security;
alter table public.services enable row level security;
alter table public.floor_service_meters enable row level security;
alter table public.floor_memberships enable row level security;
alter table public.billing_periods enable row level security;
alter table public.bills enable row level security;
alter table public.bill_service_totals enable row level security;
alter table public.meter_readings enable row level security;
alter table public.reading_photos enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists floors_select on public.floors;
create policy floors_select on public.floors
  for select to authenticated
  using (true);

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated
  using (true);

drop policy if exists floor_service_meters_select on public.floor_service_meters;
create policy floor_service_meters_select on public.floor_service_meters
  for select to authenticated
  using (true);

drop policy if exists floor_memberships_select on public.floor_memberships;
create policy floor_memberships_select on public.floor_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists floor_memberships_admin_write on public.floor_memberships;
create policy floor_memberships_admin_write on public.floor_memberships
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists billing_periods_select on public.billing_periods;
create policy billing_periods_select on public.billing_periods
  for select to authenticated
  using (true);

drop policy if exists billing_periods_admin_insert on public.billing_periods;
create policy billing_periods_admin_insert on public.billing_periods
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists billing_periods_admin_update on public.billing_periods;
create policy billing_periods_admin_update on public.billing_periods
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists bills_admin_select on public.bills;
create policy bills_admin_select on public.bills
  for select to authenticated
  using (public.is_admin());

drop policy if exists bills_admin_write on public.bills;
create policy bills_admin_write on public.bills
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists bill_totals_admin_select on public.bill_service_totals;
create policy bill_totals_admin_select on public.bill_service_totals
  for select to authenticated
  using (public.is_admin());

drop policy if exists bill_totals_admin_write on public.bill_service_totals;
create policy bill_totals_admin_write on public.bill_service_totals
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists readings_select on public.meter_readings;
create policy readings_select on public.meter_readings
  for select to authenticated
  using (public.is_admin() or floor_id = public.user_floor_id());

drop policy if exists readings_insert on public.meter_readings;
create policy readings_insert on public.meter_readings
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      floor_id = public.user_floor_id()
      and submitted_by = auth.uid()
      and status = 'pending'
    )
  );

drop policy if exists readings_update on public.meter_readings;
create policy readings_update on public.meter_readings
  for update to authenticated
  using (
    public.is_admin()
    or (floor_id = public.user_floor_id() and status in ('pending', 'rejected'))
  )
  with check (
    public.is_admin()
    or (
      floor_id = public.user_floor_id()
      and status = 'pending'
    )
  );

drop policy if exists photos_select on public.reading_photos;
create policy photos_select on public.reading_photos
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.meter_readings r
      where r.id = reading_id
        and r.floor_id = public.user_floor_id()
    )
  );

drop policy if exists photos_insert on public.reading_photos;
create policy photos_insert on public.reading_photos
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.meter_readings r
      where r.id = reading_id
        and r.floor_id = public.user_floor_id()
        and r.status <> 'approved'
    )
  );

drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.user_floor_id() to authenticated;

insert into public.floors (code, name, occupant_name, sort_order)
values
  ('piso-1', 'Piso 1', 'Nasly', 1),
  ('piso-2', 'Piso 2', 'Lucy', 2),
  ('piso-3', 'Piso 3', 'Juan', 3)
on conflict (code) do update
set occupant_name = excluded.occupant_name;

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
values
  ('energia', 'Energía', 'kWh', 'metered', null, 1),
  ('agua', 'Agua', 'm³', 'metered', null, 2)
on conflict (code) do nothing;

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
select 'alcantarillado', 'Alcantarillado', 'm³', 'copied', id, 3
from public.services
where code = 'agua'
on conflict (code) do nothing;

insert into public.floor_service_meters (floor_id, service_id)
select f.id, s.id
from public.floors f
cross join public.services s
where f.code in ('piso-1', 'piso-2')
  and s.code in ('energia', 'agua')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bills', 'bills', false, 10485760, array['application/pdf']::text[]),
  ('reading-photos', 'reading-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bills_storage_select on storage.objects;
create policy bills_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'bills' and public.is_admin());

drop policy if exists bills_storage_insert on storage.objects;
create policy bills_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bills' and public.is_admin());

drop policy if exists bills_storage_update on storage.objects;
create policy bills_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'bills' and public.is_admin())
  with check (bucket_id = 'bills' and public.is_admin());

drop policy if exists photos_storage_select on storage.objects;
create policy photos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reading-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_floor_id()::text
    )
  );

drop policy if exists photos_storage_insert on storage.objects;
create policy photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reading-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.user_floor_id()::text
    )
  );
