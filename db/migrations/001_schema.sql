-- Vivienda: esquema para PostgreSQL estándar.
-- Requiere PostgreSQL 13 o superior (gen_random_uuid() viene incorporado).
-- La autorización vive en la aplicación (lib/auth, lib/domain/permissions),
-- no en políticas RLS.

create type public.user_role as enum ('admin', 'floor_user');
create type public.consumption_source as enum ('metered', 'copied');
create type public.period_status as enum ('open', 'ready', 'closed');
create type public.reading_status as enum ('pending', 'approved', 'rejected');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text not null,
  role public.user_role not null default 'floor_user',
  password_hash text not null,
  created_at timestamptz not null default now(),
  constraint users_username_format_chk check (username ~ '^[a-z][a-z0-9_-]{1,31}$')
);

-- Sesiones de inicio de sesión. La cookie lleva un token aleatorio y aquí
-- solo se guarda su hash SHA-256.
create table public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index user_sessions_user_idx on public.user_sessions (user_id);
create index user_sessions_expires_idx on public.user_sessions (expires_at);

create table public.floors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  occupant_name text not null,
  sort_order integer not null unique
);

create table public.services (
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

create table public.floor_service_meters (
  floor_id uuid not null references public.floors (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (floor_id, service_id)
);

create table public.floor_memberships (
  user_id uuid primary key references public.users (id) on delete cascade,
  floor_id uuid not null references public.floors (id) on delete restrict
);

create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date not null,
  ends_on date not null,
  status public.period_status not null default 'open',
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  constraint billing_periods_dates_chk check (starts_on <= ends_on)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.billing_periods (id) on delete cascade,
  pdf_storage_path text,
  uploaded_by uuid references public.users (id),
  uploaded_at timestamptz,
  notes text,
  other_services_ap_subtotal numeric(14, 2)
);

create table public.bill_service_totals (
  bill_id uuid not null references public.bills (id) on delete cascade,
  service_id uuid not null references public.services (id),
  total_consumption numeric(14, 3) not null check (total_consumption >= 0),
  primary key (bill_id, service_id)
);

create table public.bill_service_charges (
  bill_id uuid not null references public.bills (id) on delete cascade,
  service_id uuid not null references public.services (id),
  charge_code text not null,
  amount numeric(14, 2) not null,
  primary key (bill_id, service_id, charge_code),
  constraint bill_service_charges_code_chk check (
    charge_code in (
      'consumo_basico_hasta_173',
      'consumo_mayor_al_basico',
      'interes_mora',
      'otros_cobros',
      'ajuste_al_peso',
      'cargo_basico',
      'consumo_basico_hasta_16',
      'minimo_vital'
    )
  )
);

create table public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.billing_periods (id) on delete cascade,
  floor_id uuid not null references public.floors (id),
  service_id uuid not null references public.services (id),
  submitted_value numeric(14, 3) not null check (submitted_value >= 0),
  submitted_by uuid not null references public.users (id),
  submitted_at timestamptz not null default now(),
  value numeric(14, 3) not null check (value >= 0),
  reading_date date not null,
  status public.reading_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  corrected_by uuid references public.users (id),
  corrected_at timestamptz,
  current_photo_id uuid,
  unique (period_id, floor_id, service_id),
  constraint meter_readings_has_meter_fk
    foreign key (floor_id, service_id)
    references public.floor_service_meters (floor_id, service_id)
);

create table public.reading_photos (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.meter_readings (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now()
);

alter table public.meter_readings
  add constraint meter_readings_current_photo_id_fkey
  foreign key (current_photo_id)
  references public.reading_photos (id)
  on delete set null;

-- Archivos (PDF de recibos y fotos de contadores). Viven en la misma base de
-- datos para que la aplicación solo necesite DATABASE_URL. Las tablas de
-- negocio guardan la ruta (bucket + path) y nunca el contenido, así los
-- SELECT habituales no arrastran los bytes.
create table public.stored_files (
  bucket text not null,
  path text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  data bytea not null,
  created_at timestamptz not null default now(),
  primary key (bucket, path)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id),
  occurred_at timestamptz not null default now(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  from_data jsonb,
  to_data jsonb
);

create index meter_readings_period_idx on public.meter_readings (period_id);
create index reading_photos_reading_idx on public.reading_photos (reading_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index billing_periods_dates_idx on public.billing_periods (starts_on, ends_on);

-- Quién hace el cambio. La aplicación ejecuta cada escritura auditada dentro
-- de una transacción que fija app.user_id (ver lib/db/pool.ts, transaction()).
create function public.app_actor()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create function public.audit_meter_reading_change()
returns trigger
language plpgsql
as $$
declare
  action_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (public.app_actor(), 'meter_reading', new.id, 'reading.submitted', null, to_jsonb(new));
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
  values (public.app_actor(), 'meter_reading', new.id, action_name, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger trg_audit_meter_readings
  after insert or update on public.meter_readings
  for each row execute procedure public.audit_meter_reading_change();

create function public.audit_bill_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (public.app_actor(), 'bill', new.id, 'bill.created', null, to_jsonb(new));
    return new;
  end if;

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
  values (public.app_actor(), 'bill', new.id, 'bill.updated', to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger trg_audit_bills
  after insert or update on public.bills
  for each row execute procedure public.audit_bill_change();

create function public.audit_period_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (public.app_actor(), 'billing_period', new.id, 'period.created', null, to_jsonb(new));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (public.app_actor(), 'billing_period', old.id, 'period.deleted', to_jsonb(old), null);
    return old;
  end if;

  if old.status is distinct from new.status then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (public.app_actor(), 'billing_period', new.id, 'period.status_changed', to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

create trigger trg_audit_periods
  after insert or update or delete on public.billing_periods
  for each row execute procedure public.audit_period_change();

-- Catálogo inicial: 3 pisos, 3 servicios y los 4 contadores.
insert into public.floors (code, name, occupant_name, sort_order)
values
  ('piso-1', 'Piso 1', 'Nasly', 1),
  ('piso-2', 'Piso 2', 'Lucy', 2),
  ('piso-3', 'Piso 3', 'Juan', 3);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
values
  ('agua', 'Agua', 'm³', 'metered', null, 1),
  ('energia', 'Energía', 'kWh', 'metered', null, 3);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
select 'alcantarillado', 'Alcantarillado', 'm³', 'copied', id, 2
from public.services
where code = 'agua';

insert into public.floor_service_meters (floor_id, service_id)
select f.id, s.id
from public.floors f
cross join public.services s
where f.code in ('piso-1', 'piso-2')
  and s.code in ('energia', 'agua');
