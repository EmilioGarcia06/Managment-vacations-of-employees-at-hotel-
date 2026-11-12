export interface Employee {
  id: string;
  fullName: string;
  position: string | null;
  age: number;
  sex: 'Hombre' | 'Mujer';
  birthDate: string;
  hireDate: string;
  weeklyRestDay: number | null;
  active: boolean;
}

export interface VacationRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  daysTaken: number;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  recordType: 'enjoyed' | 'adjustment' | 'reversal' | 'imported';
  recordStatus: 'scheduled' | 'enjoyed' | 'reversed';
  source: string;
  registeredAt: string;
}

export interface VacationPeriod {
  number: number;
  startDate: string;
  endDate: string;
  entitledDays: number;
  enjoyedDays: number;
  scheduledDays: number;
  remainingDays: number;
}

export interface VacationPeriodAdjustment {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  enjoyedDays: number;
  remainingDays: number;
  reason: string;
  createdAt: string;
}

export interface VacationBalance {
  entitlement: number;
  used: number;
  remaining: number;
}
