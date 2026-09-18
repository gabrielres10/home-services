-- El administrador puede borrar un período (cascade de recibo, lecturas y fotos).
-- También puede borrar los archivos de Storage asociados.

drop policy if exists billing_periods_admin_delete on public.billing_periods;
create policy billing_periods_admin_delete on public.billing_periods
  for delete to authenticated
  using (public.is_admin());

drop policy if exists readings_admin_delete on public.meter_readings;
create policy readings_admin_delete on public.meter_readings
  for delete to authenticated
  using (public.is_admin());

drop policy if exists photos_admin_delete on public.reading_photos;
create policy photos_admin_delete on public.reading_photos
  for delete to authenticated
  using (public.is_admin());

drop policy if exists bills_storage_delete on storage.objects;
create policy bills_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'bills' and public.is_admin());

drop policy if exists photos_storage_delete on storage.objects;
create policy photos_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'reading-photos' and public.is_admin());

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

  if tg_op = 'DELETE' then
    insert into public.audit_logs (actor_id, entity_type, entity_id, action, from_data, to_data)
    values (auth.uid(), 'billing_period', old.id, 'period.deleted', to_jsonb(old), null);
    return old;
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
  after insert or update or delete on public.billing_periods
  for each row execute procedure public.audit_period_change();
