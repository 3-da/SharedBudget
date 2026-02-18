import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PersonalExpenseStore } from './personal-expense.store';
import { PersonalExpenseService } from '../services/personal-expense.service';
import { ExpensePaymentService } from '../services/expense-payment.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('PersonalExpenseStore', () => {
  let store: PersonalExpenseStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    snackBar = { open: vi.fn() };
    const paymentService = {
      markPaid: vi.fn(),
      undoPaid: vi.fn(),
      cancel: vi.fn(),
      getStatus: vi.fn().mockReturnValue(of([])),
      getBatchStatuses: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        PersonalExpenseStore,
        { provide: PersonalExpenseService, useValue: service },
        { provide: ExpensePaymentService, useValue: paymentService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    store = TestBed.inject(PersonalExpenseStore);
  });

  const mockExpense = {
    id: 'e-1', name: 'Rent', amount: 1000, type: 'PERSONAL',
    category: 'RECURRING', frequency: 'MONTHLY',
    yearlyPaymentStrategy: null, installmentFrequency: null,
    paymentMonth: null, paidByUserId: null, month: null, year: null,
    createdById: 'u-1', createdAt: '2025-01-01',
  };

  it('loadExpenses sets expenses signal', () => {
    service['list'].mockReturnValue(of([mockExpense]));
    store.loadExpenses(3, 2025);
    expect(store.expenses()).toEqual([mockExpense]);
    expect(store.loading()).toBe(false);
  });

  it('loadExpenses sets empty array on error', () => {
    service['list'].mockReturnValue(throwError(() => new Error()));
    store.loadExpenses();
    expect(store.expenses()).toEqual([]);
  });

  it('totalMonthly computed sums amounts', () => {
    const e2 = { ...mockExpense, id: 'e-2', amount: 500 };
    service['list'].mockReturnValue(of([mockExpense, e2]));
    store.loadExpenses();
    expect(store.totalMonthly()).toBe(1500);
  });

  it('loadExpense sets selectedExpense', () => {
    service['get'].mockReturnValue(of(mockExpense));
    store.loadExpense('e-1');
    expect(store.selectedExpense()).toEqual(mockExpense);
  });

  it('createExpense reloads expenses on success', () => {
    service['create'].mockReturnValue(of(mockExpense));
    service['list'].mockReturnValue(of([mockExpense]));
    store.createExpense({ name: 'Rent', amount: 1000 }, 3, 2025);
    expect(service['list']).toHaveBeenCalledWith(3, 2025);
  });

  it('updateExpense reloads expenses on success', () => {
    service['update'].mockReturnValue(of(mockExpense));
    service['list'].mockReturnValue(of([mockExpense]));
    store.updateExpense('e-1', { amount: 1100 }, 3, 2025);
    expect(service['list']).toHaveBeenCalledWith(3, 2025);
  });

  it('deleteExpense reloads expenses on success', () => {
    service['delete'].mockReturnValue(of({ message: 'ok' }));
    service['list'].mockReturnValue(of([]));
    store.deleteExpense('e-1', 3, 2025);
    expect(service['list']).toHaveBeenCalledWith(3, 2025);
  });

  it('sets error on createExpense failure', () => {
    service['create'].mockReturnValue(throwError(() => ({ error: { message: 'fail' } })));
    store.createExpense({ name: 'X', amount: 1 });
    expect(store.error()).toBe('fail');
  });
});
