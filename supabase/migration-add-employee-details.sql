-- Ejecuta esta migración si la tabla employees ya existía antes de agregar
-- edad, sexo y cumpleaños. No elimina ni modifica los registros existentes.
alter table public.employees
  add column if not exists age integer,
  add column if not exists sex text,
  add column if not exists birth_date date;

alter table public.employees
  drop constraint if exists employees_age_check;

alter table public.employees
  add constraint employees_age_check check (age is null or age between 1 and 120);

alter table public.employees
  drop constraint if exists employees_sex_check;

alter table public.employees
  add constraint employees_sex_check check (sex is null or sex in ('Hombre', 'Mujer'));

-- Los registros nuevos se validan desde el formulario Angular.
-- Antes de hacer estas columnas NOT NULL, completa los datos de empleados antiguos.
