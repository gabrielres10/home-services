-- Borra datos de prueba y vuelve a sembrar el catálogo.
-- No toca el esquema (tablas, funciones, triggers).
-- Borra también usuarios, sesiones y archivos guardados.

begin;

truncate table
  public.audit_logs,
  public.reading_photos,
  public.meter_readings,
  public.bill_service_charges,
  public.bill_service_totals,
  public.bills,
  public.billing_periods,
  public.floor_memberships,
  public.floor_service_meters,
  public.user_sessions,
  public.users,
  public.stored_files,
  public.services,
  public.floors
restart identity cascade;

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

commit;
