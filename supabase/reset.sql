-- Borra datos de prueba y vuelve a sembrar catálogo.
-- No toca el esquema (tablas, RLS, funciones, buckets).
-- Los archivos de Storage se borran por API desde scripts/reset-db.mjs.

begin;

truncate table
  public.audit_logs,
  public.reading_photos,
  public.meter_readings,
  public.bill_service_totals,
  public.bills,
  public.billing_periods,
  public.floor_memberships,
  public.floor_service_meters,
  public.profiles,
  public.services,
  public.floors
restart identity cascade;

delete from auth.users;

insert into public.floors (code, name, sort_order)
values
  ('piso-1', 'Piso 1', 1),
  ('piso-2', 'Piso 2', 2),
  ('piso-3', 'Piso 3', 3);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
values
  ('energia', 'Energía', 'kWh', 'metered', null, 1),
  ('agua', 'Agua', 'm³', 'metered', null, 2);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
select 'alcantarillado', 'Alcantarillado', 'm³', 'copied', id, 3
from public.services
where code = 'agua';

insert into public.floor_service_meters (floor_id, service_id)
select f.id, s.id
from public.floors f
cross join public.services s
where f.code in ('piso-1', 'piso-2')
  and s.code in ('energia', 'agua');

commit;

insert into public.floors (code, name, sort_order)
values
  ('piso-1', 'Piso 1', 1),
  ('piso-2', 'Piso 2', 2),
  ('piso-3', 'Piso 3', 3);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
values
  ('energia', 'Energía', 'kWh', 'metered', null, 1),
  ('agua', 'Agua', 'm³', 'metered', null, 2);

insert into public.services (code, name, unit, consumption_source, copied_from_service_id, sort_order)
select 'alcantarillado', 'Alcantarillado', 'm³', 'copied', id, 3
from public.services
where code = 'agua';

insert into public.floor_service_meters (floor_id, service_id)
select f.id, s.id
from public.floors f
cross join public.services s
where f.code in ('piso-1', 'piso-2')
  and s.code in ('energia', 'agua');

commit;
