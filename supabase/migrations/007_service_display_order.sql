-- Orden de captura en el recibo: agua, alcantarillado, energía.
-- sort_order es único: primero se apartan los valores y después se asignan.
update public.services set sort_order = sort_order + 100;
update public.services set sort_order = 1 where code = 'agua';
update public.services set sort_order = 2 where code = 'alcantarillado';
update public.services set sort_order = 3 where code = 'energia';
