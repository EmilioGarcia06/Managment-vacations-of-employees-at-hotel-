import { Injectable } from '@angular/core';
import { Employee, VacationPeriodAdjustment, VacationRecord } from './models';
import { createSupabaseClient } from './supabase';

@Injectable({ providedIn: 'root' })
export class VacationDataService {
  private readonly client = createSupabaseClient();

  async updateEmployee(
    id: string,
    fullName: string,
    position: string,
    age: number,
    sex: Employee['sex'],
    birthDate: string,
    hireDate: string,
    weeklyRestDay: number
  ): Promise<void> {
    const { error } = await this.client
      .from('employees')
      .update({
        full_name: fullName.trim(),
        position: position.trim() || null,
        age,
        sex,
        birth_date: birthDate,
        hire_date: hireDate,
        weekly_rest_day: weeklyRestDay
      })
      .eq('id', id);

    if (error) {
      throw new Error(`No se pudo modificar el empleado: ${error.message}`);
    }
  }

  async deactivateEmployee(id: string): Promise<void> {
    const { error } = await this.client.from('employees').update({ active: false }).eq('id', id);

    if (error) {
      throw new Error(`No se pudo eliminar el empleado: ${error.message}`);
    }
  }

  async createEmployee(
    fullName: string,
    position: string,
    age: number,
    sex: Employee['sex'],
    birthDate: string,
    hireDate: string,
    weeklyRestDay: number
  ): Promise<Employee> {
    const { data, error } = await this.client
      .from('employees')
      .insert({
        full_name: fullName.trim(),
        position: position.trim() || null,
        age,
        sex,
        birth_date: birthDate,
        hire_date: hireDate,
        weekly_rest_day: weeklyRestDay
      })
      .select('id, full_name, position, age, sex, birth_date, hire_date, weekly_rest_day, active')
      .single();

    if (error) {
      throw new Error(`No se pudo guardar el empleado: ${error.message}`);
    }

    return {
      id: data.id,
      fullName: data.full_name,
      position: data.position,
      age: data.age,
      sex: data.sex,
      birthDate: data.birth_date,
      hireDate: data.hire_date,
      weeklyRestDay: data.weekly_rest_day,
      active: data.active
    };
  }

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await this.client
      .from('employees')
      .select('id, full_name, position, age, sex, birth_date, hire_date, weekly_rest_day, active')
      .order('full_name');

    if (error) {
      throw new Error(`No se pudieron consultar los empleados: ${error.message}`);
    }

    return (data ?? []).map((employee) => ({
      id: employee.id,
      fullName: employee.full_name,
      position: employee.position,
      age: employee.age,
      sex: employee.sex,
      birthDate: employee.birth_date,
      hireDate: employee.hire_date,
      weeklyRestDay: employee.weekly_rest_day,
      active: employee.active
    }));
  }

  async getVacationRecords(): Promise<VacationRecord[]> {
    const { data, error } = await this.client
      .from('vacation_records')
      .select('id, employee_id, start_date, end_date, days_taken, notes, period_start, period_end, record_type, record_status, source, registered_at');

    if (error) {
      throw new Error(`No se pudieron consultar las vacaciones: ${error.message}`);
    }

    return (data ?? []).map((record) => ({
      id: record.id,
      employeeId: record.employee_id,
      startDate: record.start_date,
      endDate: record.end_date,
      daysTaken: record.days_taken,
      notes: record.notes,
      periodStart: record.period_start,
      periodEnd: record.period_end,
      recordType: record.record_type,
      recordStatus: record.record_status,
      source: record.source,
      registeredAt: record.registered_at
    }));
  }

  async syncVacationStatuses(): Promise<VacationRecord[]> {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await this.client
      .from('vacation_records')
      .update({ record_status: 'enjoyed' })
      .eq('record_status', 'scheduled')
      .lte('start_date', today);

    if (error) {
      throw new Error(`No se pudieron actualizar los estados vacacionales: ${error.message}`);
    }

    return this.getVacationRecords();
  }

  async createVacationRecord(input: {
    employeeId: string;
    startDate: string;
    endDate: string;
    daysTaken: number;
    periodStart: string;
    periodEnd: string;
    notes: string;
    recordStatus: 'scheduled' | 'enjoyed';
  }): Promise<void> {
    await this.ensureNoOverlappingVacation(
      input.employeeId,
      input.startDate,
      input.endDate
    );

    const { error } = await this.client.from('vacation_records').insert({
      employee_id: input.employeeId,
      start_date: input.startDate,
      end_date: input.endDate,
      days_taken: input.daysTaken,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      notes: input.notes.trim() || null,
      record_type: 'enjoyed',
      record_status: input.recordStatus,
      source: 'manual'
    });

    if (error) {
      throw new Error(`No se pudo registrar la vacación: ${error.message}`);
    }
  }

  async updateVacationRecord(
    id: string,
    startDate: string,
    endDate: string,
    daysTaken: number,
    notes: string
  ): Promise<void> {
    const { data: current, error: currentError } = await this.client
      .from('vacation_records')
      .select('employee_id')
      .eq('id', id)
      .eq('record_status', 'scheduled')
      .single();

    if (currentError || !current) {
      throw new Error('La vacación ya no está programada o no existe.');
    }

    await this.ensureNoOverlappingVacation(current.employee_id, startDate, endDate, id);

    const { error } = await this.client
      .from('vacation_records')
      .update({
        start_date: startDate,
        end_date: endDate,
        days_taken: daysTaken,
        notes: notes.trim() || null
      })
      .eq('id', id)
      .eq('record_status', 'scheduled');

    if (error) {
      throw new Error(`No se pudo modificar la vacación: ${error.message}`);
    }
  }

  async markVacationAsEnjoyed(id: string): Promise<void> {
    const { data, error } = await this.client
      .from('vacation_records')
      .update({ record_status: 'enjoyed' })
      .eq('id', id)
      .eq('record_status', 'scheduled')
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`No se pudo marcar la vacación como disfrutada: ${error.message}`);
    }
    if (!data) {
      throw new Error('La vacación ya no está programada o no existe.');
    }
  }

  async reverseVacationRecord(id: string): Promise<void> {
    const { error } = await this.client
      .from('vacation_records')
      .update({ record_status: 'reversed' })
      .eq('id', id)
      .in('record_status', ['scheduled', 'enjoyed']);

    if (error) {
      throw new Error(`No se pudo cancelar la vacación: ${error.message}`);
    }
  }

  private async ensureNoOverlappingVacation(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludedId?: string
  ): Promise<void> {
    const { data, error } = await this.client
      .from('vacation_records')
      .select('id')
      .eq('employee_id', employeeId)
      .in('record_status', ['scheduled', 'enjoyed'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (error) {
      throw new Error(`No se pudo validar el período vacacional: ${error.message}`);
    }

    if ((data ?? []).some((record) => record.id !== excludedId)) {
      throw new Error('El empleado ya tiene otra vacación activa o programada que se traslapa con estas fechas.');
    }
  }

  async getVacationAdjustments(): Promise<VacationPeriodAdjustment[]> {
    const { data, error } = await this.client
      .from('vacation_period_adjustments')
      .select('id, employee_id, period_start, period_end, enjoyed_days, remaining_days, reason, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`No se pudieron consultar los ajustes: ${error.message}`);
    }

    return (data ?? []).map((adjustment) => ({
      id: adjustment.id,
      employeeId: adjustment.employee_id,
      periodStart: adjustment.period_start,
      periodEnd: adjustment.period_end,
      enjoyedDays: adjustment.enjoyed_days,
      remainingDays: adjustment.remaining_days,
      reason: adjustment.reason,
      createdAt: adjustment.created_at
    }));
  }

  async createVacationAdjustment(input: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    enjoyedDays: number;
    remainingDays: number;
    reason: string;
  }): Promise<void> {
    const { error } = await this.client.from('vacation_period_adjustments').insert({
      employee_id: input.employeeId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      enjoyed_days: input.enjoyedDays,
      remaining_days: input.remainingDays,
      reason: input.reason.trim()
    });

    if (error) {
      throw new Error(`No se pudo guardar el ajuste: ${error.message}`);
    }
  }
}
