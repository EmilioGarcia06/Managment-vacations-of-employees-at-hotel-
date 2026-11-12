-- Migración no destructiva para el panel administrativo de vacaciones.
-- Conserva employees y vacation_records existentes.

alter table public.employees
  add column if not exists weekly_rest_day smallint;

alter table public.employees
  drop constraint if exists employees_weekly_rest_day_check;

alter table public.employees
  add constraint employees_weekly_rest_day_check
  check (weekly_rest_day is null or weekly_rest_day between 0 and 6);

alter table public.vacation_records
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists record_type text not null default 'enjoyed',
  add column if not exists record_status text not null default 'enjoyed',
  add column if not exists source text not null default 'manual',
  add column if not exists registered_at timestamptz not null default now(),
  add column if not exists reversed_record_id uuid references public.vacation_records(id);

alter table public.vacation_records
  drop constraint if exists vacation_records_record_type_check;

alter table public.vacation_records
  add constraint vacation_records_record_type_check
  check (record_type in ('enjoyed', 'adjustment', 'reversal', 'imported'));

alter table public.vacation_records
  drop constraint if exists vacation_records_record_status_check;

alter table public.vacation_records
  add constraint vacation_records_record_status_check
  check (record_status in ('scheduled', 'enjoyed', 'reversed'));

create index if not exists vacation_records_period_idx
  on public.vacation_records(employee_id, period_start, period_end);

create index if not exists vacation_records_status_idx
  on public.vacation_records(record_status);

create or replace function public.prevent_overlapping_vacations()
returns trigger
language plpgsql
as $$
begin
  if new.record_status in ('scheduled', 'enjoyed')
     and exists (
       select 1
       from public.vacation_records existing
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

drop trigger if exists vacation_records_no_overlap on public.vacation_records;

create trigger vacation_records_no_overlap
before insert or update of employee_id, start_date, end_date, record_status
on public.vacation_records
for each row
execute function public.prevent_overlapping_vacations();

create table if not exists public.vacation_period_adjustments (
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

drop policy if exists "temporary vacation adjustments access"
  on public.vacation_period_adjustments;
drop policy if exists "authenticated vacation adjustments access"
  on public.vacation_period_adjustments;

create policy "authenticated vacation adjustments access"
  on public.vacation_period_adjustments for all
  to authenticated using (true) with check (true);

drop policy if exists "temporary employees access" on public.employees;
drop policy if exists "authenticated employees access" on public.employees;
drop policy if exists "temporary employees access" on public.employees;
create policy "authenticated employees access"
  on public.employees for all
  to authenticated using (true) with check (true);

drop policy if exists "temporary vacation records access" on public.vacation_records;
drop policy if exists "authenticated vacation records access" on public.vacation_records;
drop policy if exists "temporary vacation records access" on public.vacation_records;
create policy "authenticated vacation records access"
  on public.vacation_records for all
  to authenticated using (true) with check (true);

create index if not exists vacation_period_adjustments_lookup_idx
  on public.vacation_period_adjustments(employee_id, period_start, created_at desc);
