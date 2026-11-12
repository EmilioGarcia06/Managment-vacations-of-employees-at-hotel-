import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { VacationDataService } from './core/vacation-data.service';
import { AuthService } from './core/auth.service';
import { Employee, VacationPeriod, VacationPeriodAdjustment, VacationRecord } from './core/models';
import { anniversaryDate, completedYears, vacationDaysIncludingWeeklyRest, vacationPeriods } from './core/vacation-rules';

@Component({
  selector: 'app-root',
  imports: [DatePipe, FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly today = new Date();
  private readonly vacationData = inject(VacationDataService);
  private readonly auth = inject(AuthService);
  protected readonly authReady = this.auth.ready;
  protected readonly session = this.auth.session;
  protected authEmail = '';
  protected authPassword = '';
  protected authError = '';
  protected authSaving = false;
  protected readonly activeEmployees = signal(0);
  protected readonly vacationRecordCount = signal(0);
  protected readonly connectionStatus = signal('Conectando...');
  protected readonly connectionError = signal('');
  protected readonly showEmployeeForm = signal(false);
  protected readonly isSavingEmployee = signal(false);
  protected readonly employeeSavedMessage = signal('');
  protected readonly employees = signal<Employee[]>([]);
  protected readonly selectedEmployee = signal<Employee | null>(null);
  protected readonly activeView = signal<'dashboard' | 'employees' | 'vacations'>('dashboard');
  protected editingEmployeeId: string | null = null;
  protected employeeName = '';
  protected employeePosition = '';
  protected employeeAge: number | null = null;
  protected employeeSex: 'Hombre' | 'Mujer' | '' = '';
  protected employeeBirthDate = '';
  protected employeeHireDate = '';
  protected employeeWeeklyRestDay: number | null = null;
  protected readonly vacationRecords = signal<VacationRecord[]>([]);
  protected readonly vacationAdjustments = signal<VacationPeriodAdjustment[]>([]);
  protected readonly vacationSearch = signal('');
  protected readonly vacationSexFilter = signal('');
  protected readonly vacationStatusFilter = signal('');
  protected readonly vacationTenureFilter = signal('');
  protected readonly vacationSort = signal<'hireDate' | 'balance'>('hireDate');
  protected readonly selectedVacationEmployee = signal<Employee | null>(null);
  protected readonly vacationFormOpen = signal(false);
  protected vacationStartDate = '';
  protected vacationEndDate = '';
  protected vacationNotes = '';
  protected vacationSaving = false;
  protected adjustmentPeriod: VacationPeriod | null = null;
  protected adjustmentEnjoyedDays: number | null = null;
  protected adjustmentRemainingDays: number | null = null;
  protected adjustmentReason = '';
  protected adjustmentSaving = false;
  protected editingVacationId: string | null = null;

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.initialize();
      if (this.session()) {
        await this.loadApplicationData();
      }
    } catch (error) {
      this.connectionStatus.set('Error de conexión');
      this.connectionError.set(
        error instanceof Error ? error.message : 'No se pudo cargar la información del sistema.'
      );
      this.authReady.set(true);
    }
  }

  protected async signIn(): Promise<void> {
    if (!this.authEmail.trim() || !this.authPassword) {
      this.authError = 'Escribe tu correo y contraseña.';
      return;
    }

    this.authSaving = true;
    this.authError = '';
    try {
      await this.auth.signIn(this.authEmail, this.authPassword);
      this.authPassword = '';
      await this.loadApplicationData();
    } catch (error) {
      this.authError = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
    } finally {
      this.authSaving = false;
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      this.activeView.set('dashboard');
      this.connectionStatus.set('Sesión cerrada');
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo cerrar sesión.');
    }
  }

  private async loadApplicationData(): Promise<void> {
    if (!this.session()) {
      throw new Error('La sesión no está disponible. Cierra sesión e inicia nuevamente.');
    }

    const [employees, records, adjustments] = await Promise.all([
      this.vacationData.getEmployees(),
      this.vacationData.syncVacationStatuses(),
      this.vacationData.getVacationAdjustments()
    ]);

    this.setEmployeesInDisplayOrder(employees);
    this.activeEmployees.set(employees.filter((employee) => employee.active).length);
    this.vacationRecords.set(records);
    this.vacationAdjustments.set(adjustments);
    this.vacationRecordCount.set(records.filter((record) => record.recordStatus !== 'reversed').length);
    this.connectionStatus.set('Supabase conectado');
    this.connectionError.set('');
  }

  protected openEmployeeForm(): void {
    this.editingEmployeeId = null;
    this.employeeName = '';
    this.employeePosition = '';
    this.employeeAge = null;
    this.employeeSex = '';
    this.employeeBirthDate = '';
    this.employeeHireDate = '';
    this.employeeWeeklyRestDay = null;
    this.employeeSavedMessage.set('');
    this.connectionError.set('');
    this.showEmployeeForm.set(true);
  }

  protected viewEmployee(employee: Employee): void {
    this.selectedEmployee.set(employee);
  }

  protected closeEmployeeDetails(): void {
    this.selectedEmployee.set(null);
  }

  protected editEmployee(employee: Employee): void {
    this.editingEmployeeId = employee.id;
    this.employeeName = employee.fullName;
    this.employeePosition = employee.position ?? '';
    this.employeeAge = employee.age;
    this.employeeSex = employee.sex;
    this.employeeBirthDate = employee.birthDate;
    this.employeeHireDate = employee.hireDate;
    this.employeeWeeklyRestDay = employee.weeklyRestDay;
    this.employeeSavedMessage.set('');
    this.connectionError.set('');
    this.showEmployeeForm.set(true);
  }

  protected closeEmployeeForm(): void {
    if (!this.isSavingEmployee()) {
      this.showEmployeeForm.set(false);
    }
  }

  protected async saveEmployee(): Promise<void> {
    if (
      !this.employeeName.trim() ||
      !this.employeeAge ||
      this.employeeAge < 1 ||
      !this.employeeSex ||
      !this.employeeBirthDate ||
      !this.employeeHireDate
      || this.employeeWeeklyRestDay === null
    ) {
      this.connectionError.set(
        'Completa nombre, edad, sexo, cumpleaños, fecha de ingreso y día de descanso para continuar.'
      );
      return;
    }

    this.isSavingEmployee.set(true);
    this.connectionError.set('');
    this.employeeSavedMessage.set('');

    try {
      if (this.editingEmployeeId) {
        await this.vacationData.updateEmployee(
          this.editingEmployeeId,
          this.employeeName,
          this.employeePosition,
          this.employeeAge,
          this.employeeSex,
          this.employeeBirthDate,
          this.employeeHireDate,
          this.employeeWeeklyRestDay
        );
      } else {
        await this.vacationData.createEmployee(
          this.employeeName,
          this.employeePosition,
          this.employeeAge,
          this.employeeSex,
          this.employeeBirthDate,
          this.employeeHireDate,
          this.employeeWeeklyRestDay
        );
      }
      const savedEmployee = await this.vacationData.getEmployees();
      this.setEmployeesInDisplayOrder(savedEmployee);
      this.activeEmployees.set(savedEmployee.filter((employee) => employee.active).length);
      this.employeeSavedMessage.set(
        this.editingEmployeeId
          ? 'Empleado modificado correctamente.'
          : 'Empleado guardado correctamente.'
      );
      this.editingEmployeeId = null;
      this.employeeName = '';
      this.employeePosition = '';
      this.employeeAge = null;
      this.employeeSex = '';
      this.employeeBirthDate = '';
      this.employeeHireDate = '';
      this.employeeWeeklyRestDay = null;
      this.showEmployeeForm.set(false);
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo guardar el empleado.');
    } finally {
      this.isSavingEmployee.set(false);
    }
  }

  protected async deleteEmployee(employee: Employee): Promise<void> {
    const confirmed = window.confirm(
      `Estas seguro que deseas elimnar el siguiente Empleado ${employee.fullName}`
    );

    if (!confirmed) {
      return;
    }

    this.connectionError.set('');

    try {
      await this.vacationData.deactivateEmployee(employee.id);
      const savedEmployees = await this.vacationData.getEmployees();
      this.setEmployeesInDisplayOrder(savedEmployees);
      this.activeEmployees.set(savedEmployees.filter((item) => item.active).length);
      this.employeeSavedMessage.set('Empleado eliminado correctamente.');
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo eliminar el empleado.');
    }
  }

  protected showView(view: 'dashboard' | 'employees' | 'vacations'): void {
    this.activeView.set(view);
    this.connectionError.set('');
  }

  protected vacationEmployees(): Employee[] {
    const search = this.vacationSearch().trim().toLowerCase();
    return this.employees().filter((employee) => {
      if (!employee.active || !employee.fullName.toLowerCase().includes(search)) return false;
      if (this.vacationSexFilter() && employee.sex !== this.vacationSexFilter()) return false;
      if (this.vacationStatusFilter() && this.vacationStatus(employee) !== this.vacationStatusFilter()) return false;
      const years = completedYears(employee.hireDate);
      if (this.vacationTenureFilter() === 'new' && years >= 5) return false;
      if (this.vacationTenureFilter() === 'experienced' && years < 5) return false;
      return true;
    }).sort((first, second) => {
      if (this.vacationSort() === 'balance') {
        return (this.currentPeriod(first)?.remainingDays ?? 0) - (this.currentPeriod(second)?.remainingDays ?? 0);
      }
      return first.hireDate.localeCompare(second.hireDate);
    });
  }

  protected vacationEmployeeRecords(employee: Employee): VacationRecord[] {
    return this.vacationRecords().filter((record) => record.employeeId === employee.id);
  }

  protected vacationEmployeeAdjustments(employee: Employee): VacationPeriodAdjustment[] {
    return this.vacationAdjustments().filter((adjustment) => adjustment.employeeId === employee.id);
  }

  protected currentPeriod(employee: Employee): VacationPeriod | undefined {
    return vacationPeriods(
      employee,
      this.vacationEmployeeRecords(employee),
      this.vacationEmployeeAdjustments(employee)
    )[0];
  }

  protected pendingVacationDays(): number {
    return this.vacationEmployees().reduce(
      (total, employee) => total + (this.currentPeriod(employee)?.remainingDays ?? 0),
      0
    );
  }

  protected currentVacationEmployees(): number {
    return this.vacationEmployees().filter(
      (employee) => this.vacationStatus(employee) === 'Actualmente de vacaciones'
    ).length;
  }

  protected employeesWithTakenVacation(): number {
    return this.employees().filter(
      (employee) => employee.active && this.enjoyedDays(employee) > 0
    ).length;
  }

  protected employeesWithPendingVacation(): number {
    return Math.max(
      0,
      this.employees().filter((employee) => employee.active).length -
        this.employeesWithTakenVacation()
    );
  }

  protected vacationPieStyle(): string {
    const total = this.employees().filter((employee) => employee.active).length;
    if (total === 0) {
      return 'conic-gradient(#e7efec 0 100%)';
    }

    const takenPercentage = (this.employeesWithTakenVacation() / total) * 100;
    return `conic-gradient(#236b55 0 ${takenPercentage}%, #f5c84b ${takenPercentage}% 100%)`;
  }

  protected monthlyBirthdays(): Employee[] {
    const month = this.today.getMonth();
    return this.employees()
      .filter(
        (employee) =>
          employee.active && new Date(`${employee.birthDate}T00:00:00`).getMonth() === month
      )
      .sort((first, second) => first.birthDate.localeCompare(second.birthDate));
  }

  protected enjoyedDays(employee: Employee): number {
    return this.currentPeriod(employee)?.enjoyedDays ?? 0;
  }

  protected vacationStatus(employee: Employee): string {
    const records = this.vacationEmployeeRecords(employee);
    const today = new Date().toISOString().slice(0, 10);
    if (
      records.some(
        (record) =>
          record.recordStatus === 'enjoyed' &&
          record.startDate <= today &&
          record.endDate >= today
      )
    ) {
      return 'Actualmente de vacaciones';
    }
    const period = this.currentPeriod(employee);
    if (!period) return 'Sin período vacacional generado';
    return period.remainingDays > 0 ? 'Tiene días pendientes' : 'Al corriente';
  }

  protected vacationStatusClass(employee: Employee): string {
    switch (this.vacationStatus(employee)) {
      case 'Actualmente de vacaciones':
        return 'on-vacation';
      case 'Tiene días pendientes':
        return 'pending';
      case 'Sin período vacacional generado':
        return 'without-period';
      default:
        return 'up-to-date';
    }
  }

  protected openVacationFile(employee: Employee): void {
    this.selectedVacationEmployee.set(employee);
    this.vacationFormOpen.set(false);
  }

  protected closeVacationFile(): void {
    this.selectedVacationEmployee.set(null);
    this.vacationFormOpen.set(false);
  }

  protected startVacationForm(): void {
    this.editingVacationId = null;
    this.vacationStartDate = '';
    this.vacationEndDate = '';
    this.vacationNotes = '';
    this.connectionError.set('');
    this.vacationFormOpen.set(true);
  }

  protected vacationDaysPreview(): number {
    if (!this.vacationStartDate || !this.vacationEndDate) return 0;
    return vacationDaysIncludingWeeklyRest(this.vacationStartDate, this.vacationEndDate);
  }

  protected vacationAvailableDays(): number {
    const employee = this.selectedVacationEmployee();
    return employee ? (this.periodForVacationSave(employee)?.remainingDays ?? 0) : 0;
  }

  protected vacationFormError(): string {
    const days = this.vacationDaysPreview();
    const availableDays = this.vacationAvailableDays();
    if (days > 0 && days > availableDays) {
      return `No puedes registrar ${days} días. Solo hay ${availableDays} días restantes disponibles.`;
    }
    return '';
  }

  protected async saveVacation(): Promise<void> {
    const employee = this.selectedVacationEmployee();
    const period = employee ? this.periodForVacationSave(employee) : null;
    const days = this.vacationDaysPreview();
    if (!employee || !period || !this.vacationStartDate || !this.vacationEndDate || days <= 0) return;
    if (days > period.remainingDays) {
      this.connectionError.set(this.vacationFormError());
      return;
    }

    this.vacationSaving = true;
    this.connectionError.set('');
    try {
      if (this.editingVacationId) {
        await this.vacationData.updateVacationRecord(
          this.editingVacationId,
          this.vacationStartDate,
          this.vacationEndDate,
          days,
          this.vacationNotes
        );
      } else {
        await this.vacationData.createVacationRecord({
          employeeId: employee.id,
          startDate: this.vacationStartDate,
          endDate: this.vacationEndDate,
          daysTaken: days,
          periodStart: period.startDate,
          periodEnd: period.endDate,
          notes: this.vacationNotes,
          recordStatus: this.vacationStartDate > new Date().toISOString().slice(0, 10) ? 'scheduled' : 'enjoyed'
        });
      }
      const records = await this.vacationData.syncVacationStatuses();
      this.vacationRecords.set(records);
      this.vacationRecordCount.set(records.filter((item) => item.recordStatus !== 'reversed').length);
      this.vacationFormOpen.set(false);
      this.editingVacationId = null;
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo guardar la vacación.');
    } finally {
      this.vacationSaving = false;
    }
  }

  protected editScheduledVacation(record: VacationRecord): void {
      if (record.recordStatus !== 'scheduled') return;
      this.editingVacationId = record.id;
      this.vacationStartDate = record.startDate;
      this.vacationEndDate = record.endDate;
      this.vacationNotes = record.notes ?? '';
      this.vacationFormOpen.set(true);
  }

  protected async markVacationAsEnjoyed(record: VacationRecord): Promise<void> {
    if (record.recordStatus !== 'scheduled') return;
    try {
      await this.vacationData.markVacationAsEnjoyed(record.id);
      await this.refreshVacationRecords();
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo actualizar la vacación.');
    }
  }

  protected async cancelVacation(record: VacationRecord): Promise<void> {
    if (record.recordStatus === 'reversed') return;
    if (!window.confirm('¿Deseas cancelar este registro de vacaciones? El movimiento se conservará como revertido.')) {
      return;
    }
    try {
      await this.vacationData.reverseVacationRecord(record.id);
      await this.refreshVacationRecords();
    } catch (error) {
      this.connectionError.set(error instanceof Error ? error.message : 'No se pudo revertir la vacación.');
    }
  }

  protected employeeTenure(employee: Employee): string {
    return `${completedYears(employee.hireDate)} años`;
  }

  protected nextAnniversary(employee: Employee): Date {
    return anniversaryDate(employee.hireDate);
  }

  protected employeePeriods(employee: Employee) {
    return vacationPeriods(
      employee,
      this.vacationEmployeeRecords(employee),
      this.vacationEmployeeAdjustments(employee)
    );
  }

  private periodForVacationSave(employee: Employee): VacationPeriod | undefined {
    const records = this.vacationEmployeeRecords(employee).filter(
      (record) => record.id !== this.editingVacationId
    );
    return vacationPeriods(
      employee,
      records,
      this.vacationEmployeeAdjustments(employee)
    )[0];
  }

  private async refreshVacationRecords(): Promise<void> {
    const records = await this.vacationData.syncVacationStatuses();
    this.vacationRecords.set(records);
    this.vacationRecordCount.set(
      records.filter((item) => item.recordStatus !== 'reversed').length
    );
  }

  protected startAdjustment(period: VacationPeriod): void {
    this.adjustmentPeriod = period;
    this.adjustmentEnjoyedDays = period.enjoyedDays;
    this.adjustmentRemainingDays = period.remainingDays;
    this.adjustmentReason = '';
  }

  protected cancelAdjustment(): void {
    this.adjustmentPeriod = null;
  }

  protected updateAdjustmentEnjoyedDays(value: number | null): void {
    this.adjustmentEnjoyedDays = value;
    if (this.adjustmentPeriod && value !== null) {
      this.adjustmentRemainingDays = Math.max(0, this.adjustmentPeriod.entitledDays - value);
    }
  }

  protected async saveAdjustment(employee: Employee): Promise<void> {
    if (
      !this.adjustmentPeriod ||
      this.adjustmentEnjoyedDays === null ||
      this.adjustmentRemainingDays === null ||
      this.adjustmentEnjoyedDays < 0 ||
      this.adjustmentRemainingDays < 0 ||
      !this.adjustmentReason.trim()
    ) {
      return;
    }

    this.adjustmentSaving = true;
    try {
      await this.vacationData.createVacationAdjustment({
        employeeId: employee.id,
        periodStart: this.adjustmentPeriod.startDate,
        periodEnd: this.adjustmentPeriod.endDate,
        enjoyedDays: this.adjustmentEnjoyedDays,
        remainingDays: this.adjustmentRemainingDays,
        reason: this.adjustmentReason
      });
      this.vacationAdjustments.set(await this.vacationData.getVacationAdjustments());
      this.adjustmentPeriod = null;
    } finally {
      this.adjustmentSaving = false;
    }
  }

  private setEmployeesInDisplayOrder(employees: Employee[]): void {
    this.employees.set(
      [...employees].sort((first, second) => Number(second.active) - Number(first.active))
    );
  }
}
