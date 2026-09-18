-- Nombre de la persona asociada a cada piso.
alter table public.floors
  add column if not exists occupant_name text;

update public.floors
set occupant_name = case code
  when 'piso-1' then 'Nasly'
  when 'piso-2' then 'Lucy'
  when 'piso-3' then 'Juan'
  else coalesce(occupant_name, name)
end;

alter table public.floors
  alter column occupant_name set not null;
