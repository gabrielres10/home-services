-- Subtotal de otros servicios + alumbrado público (AP). Un solo valor por recibo / vivienda.
alter table public.bills
  add column if not exists other_services_ap_subtotal numeric(14, 2);
