create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  position text,
  age integer not null check (age between 1 and 120),
  sex text not null check (sex in ('Hombre', 'Mujer')),
  birth_date date not null,
  hire_date date not null,
  weekly_rest_day smallint not null check (weekly_rest_day between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vacation_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  start_date date not null,
  end_date date not null,
  days_taken integer not null check (days_taken > 0),
  notes text,
  period_start date,
  period_end date,
  record_type text not null default 'enjoyed'
    check (record_type in ('enjoyed', 'adjustment', 'reversal', 'imported')),
  record_status text not null default 'enjoyed'
    check (record_status in ('scheduled', 'enjoyed', 'reversed')),
  source text not null default 'manual',
  registered_at timestamptz not null default now(),
  reversed_record_id uuid references public.vacation_records(id),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index vacation_records_employee_id_idx
  on public.vacation_records(employee_id);

create or replace function public.prevent_overlapping_vacations()
returns trigger
language plpgsql
as $$
begin
  if new.record_status in ('scheduled', 'enjoyed')
     and exists (
       select 1 from public.vacation_records existing
       where existing.employee_id = new.employee_id
         and existing.id <> new.id
         and existing.record_status in ('scheduled', 'enjoyed')
         and existing.start_date <= new.end_date
         and existing.end_date >= new.start_date
     ) then
    raise exception 'El empleado ya tiene otra vacación activa o programada que se traslapa con estas fechas';
  end if;
  return new;
end;
$$;

create trigger vacation_records_no_overlap
before insert or update of employee_id, start_date, end_date, record_status
on public.vacation_records
for each row
execute function public.prevent_overlapping_vacations();

create table public.vacation_period_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  period_start date not null,
  period_end date not null,
  enjoyed_days integer not null check (enjoyed_days >= 0),
  remaining_days integer not null check (remaining_days >= 0),
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);

alter table public.vacation_period_adjustments enable row level security;

create policy "authenticated vacation adjustments access"
  on public.vacation_period_adjustments for all
  to authenticated
  using (true)
  with check (true);

create index vacation_period_adjustments_lookup_idx
  on public.vacation_period_adjustments(employee_id, period_start, created_at desc);

alter table public.employees enable row level security;
alter table public.vacation_records enable row level security;

-- Replace these policies with authenticated-user policies when login is added.
drop policy if exists "temporary employees access" on public.employees;
drop policy if exists "authenticated employees access" on public.employees;

create policy "authenticated employees access"
  on public.employees for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "temporary vacation records access" on public.vacation_records;
drop policy if exists "authenticated vacation records access" on public.vacation_records;

create policy "authenticated vacation records access"
  on public.vacation_records for all
  to authenticated
  using (true)
  with check (true);
