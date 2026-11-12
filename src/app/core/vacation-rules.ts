import {
  Employee,
  VacationBalance,
  VacationPeriod,
  VacationPeriodAdjustment,
  VacationRecord
} from './models';

export function completedYears(hireDate: string, referenceDate = new Date()): number {
  const start = new Date(`${hireDate}T00:00:00`);
  let years = referenceDate.getFullYear() - start.getFullYear();
  const anniversary = new Date(referenceDate.getFullYear(), start.getMonth(), start.getDate());
  if (referenceDate < anniversary) years--;
  return Math.max(0, years);
}

export function legalVacationDays(years: number): number {
  if (years < 1) return 0;
  if (years <= 5) return 10 + years * 2;
  return 20 + Math.ceil((years - 5) / 5) * 2;
}

export function vacationBalance(
  hireDate: string,
  usedDays: number,
  referenceDate = new Date()
): VacationBalance {
  const entitlement = legalVacationDays(completedYears(hireDate, referenceDate));
  const used = Math.max(0, usedDays);
  return { entitlement, used, remaining: Math.max(0, entitlement - used) };
}

export function inclusiveCalendarDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const difference = end.getTime() - start.getTime();
  return difference < 0 ? 0 : Math.floor(difference / 86_400_000) + 1;
}

export function vacationDaysIncludingWeeklyRest(startDate: string, endDate: string): number {
  return inclusiveCalendarDays(startDate, endDate);
}

export function anniversaryDate(hireDate: string, referenceDate = new Date()): Date {
  const start = new Date(`${hireDate}T00:00:00`);
  const anniversary = new Date(referenceDate.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  if (anniversary < today) anniversary.setFullYear(anniversary.getFullYear() + 1);
  return anniversary;
}

export function vacationPeriods(
  employee: Employee,
  records: VacationRecord[],
  adjustments: VacationPeriodAdjustment[] = [],
  referenceDate = new Date()
): VacationPeriod[] {
  const hireDate = new Date(`${employee.hireDate}T00:00:00`);
  const periods: VacationPeriod[] = [];

  for (let year = hireDate.getFullYear(); year <= referenceDate.getFullYear(); year++) {
    const start = new Date(year, hireDate.getMonth(), hireDate.getDate());
    const end = new Date(year + 1, hireDate.getMonth(), hireDate.getDate() - 1);
    if (start > referenceDate) continue;

    const periodRecords = records.filter(
      (record) =>
        record.recordStatus !== 'reversed' &&
        belongsToPeriod(record, start, end)
    );
    const latestAdjustment = adjustments
      .filter(
        (adjustment) =>
          adjustment.periodStart === toDateValue(start) &&
          adjustment.periodEnd === toDateValue(end)
      )
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0];
    const recordsAfterAdjustment = latestAdjustment
      ? periodRecords.filter(
          (record) => record.registeredAt > latestAdjustment.createdAt
        )
      : periodRecords;
    const enjoyedDays = recordsAfterAdjustment
      .filter((record) => record.recordStatus === 'enjoyed')
      .reduce((sum, record) => sum + record.daysTaken, 0);
    const scheduledDays = recordsAfterAdjustment
      .filter((record) => record.recordStatus === 'scheduled')
      .reduce((sum, record) => sum + record.daysTaken, 0);
    const adjustedEnjoyedDays = latestAdjustment
      ? latestAdjustment.enjoyedDays + enjoyedDays
      : enjoyedDays;
    const years = year - hireDate.getFullYear() + 1;
    const entitledDays = legalVacationDays(years);

    periods.push({
      number: years,
      startDate: toDateValue(start),
      endDate: toDateValue(end),
      entitledDays,
      enjoyedDays: adjustedEnjoyedDays,
      scheduledDays,
      remainingDays: latestAdjustment
        ? Math.max(0, latestAdjustment.remainingDays - enjoyedDays - scheduledDays)
        : Math.max(0, entitledDays - adjustedEnjoyedDays - scheduledDays)
    });
  }

  return periods
    .reverse()
    .slice(0, 3)
    .map((period, index) =>
      index === 0 ||
      adjustments.some(
        (adjustment) =>
          adjustment.periodStart === period.startDate &&
          adjustment.periodEnd === period.endDate
      )
        ? period
        : {
            ...period,
            enjoyedDays: 0,
            scheduledDays: 0,
            remainingDays: 0
          }
    );
}

function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function belongsToPeriod(record: VacationRecord, start: Date, end: Date): boolean {
  if (record.periodStart && record.periodEnd) {
    return record.periodStart === toDateValue(start) && record.periodEnd === toDateValue(end);
  }

  return record.startDate >= toDateValue(start) && record.startDate <= toDateValue(end);
}
