-- Importes en dinero del recibo, por servicio y renglón.
create table if not exists public.bill_service_charges (
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

alter table public.bill_service_charges enable row level security;

grant select, insert, update, delete on public.bill_service_charges to authenticated;

drop policy if exists bill_charges_admin_select on public.bill_service_charges;
create policy bill_charges_admin_select on public.bill_service_charges
  for select to authenticated
  using (public.is_admin());

drop policy if exists bill_charges_admin_write on public.bill_service_charges;
create policy bill_charges_admin_write on public.bill_service_charges
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
