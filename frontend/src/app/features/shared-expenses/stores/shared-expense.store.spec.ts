import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { SharedExpenseStore } from './shared-expense.store';
import { SharedExpenseService } from '../services/shared-expense.service';
import { ExpensePaymentService } from '../../../shared/services/expense-payment.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('SharedExpenseStore', () => {
  let store: SharedExpenseStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn(),
      get: vi.fn(),
      proposeCreate: vi.fn(),
      proposeUpdate: vi.fn(),
      proposeDelete: vi.fn(),
      getSkipStatuses: vi.fn().mockReturnValue(of([])),
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
        SharedExpenseStore,
        { provide: SharedExpenseService, useValue: service },
        { provide: ExpensePaymentService, useValue: paymentService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    store = TestBed.inject(SharedExpenseStore);
  });

  const mockExpense = {
    id: 'e-1', name: 'Groceries', amount: 200, type: 'SHARED',
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

  it('loadExpenses shows the spinner even when expenses are already populated', () => {
    service['list'].mockReturnValue(of([mockExpense]));
    store.loadExpenses();
    expect(store.expenses().length).toBe(1);

    // Switching months: never-completing observable keeps loading true during the fetch
    service['list'].mockReturnValue(new Observable(() => {}));
    store.loadExpenses(4, 2025);
    expect(store.loading()).toBe(true);
  });

  it('loadExpense sets selectedExpense', () => {
    service['get'].mockReturnValue(of(mockExpense));
    store.loadExpense('e-1');
    expect(store.selectedExpense()).toEqual(mockExpense);
  });

  it('proposeCreate shows snackbar and reloads', () => {
    service['proposeCreate'].mockReturnValue(of({}));
    service['list'].mockReturnValue(of([mockExpense]));
    store.proposeCreate({ name: 'Groceries' }, 3, 2025);
    expect(snackBar.open).toHaveBeenCalledWith('Proposal submitted for approval', '', { duration: 3000 });
    expect(service['list']).toHaveBeenCalledWith(3, 2025);
  });

  it('proposeUpdate shows snackbar and reloads', () => {
    service['proposeUpdate'].mockReturnValue(of({}));
    service['list'].mockReturnValue(of([mockExpense]));
    store.proposeUpdate('e-1', { amount: 250 }, 3, 2025);
    expect(snackBar.open).toHaveBeenCalledWith('Update proposal submitted', '', { duration: 3000 });
  });

  it('proposeDelete shows snackbar and reloads', () => {
    service['proposeDelete'].mockReturnValue(of({}));
    service['list'].mockReturnValue(of([]));
    store.proposeDelete('e-1', 3, 2025);
    expect(snackBar.open).toHaveBeenCalledWith('Delete proposal submitted', '', { duration: 3000 });
  });

  it('sets error on proposeCreate failure', () => {
    service['proposeCreate'].mockReturnValue(throwError(() => ({ error: { message: 'denied' } })));
    store.proposeCreate({ name: 'X' });
    expect(store.error()).toBe('denied');
  });

  describe('reload', () => {
    it('re-fetches the month/year the user last requested, not the current month', () => {
      service['list'].mockReturnValue(of([mockExpense]));
      store.loadExpenses(3, 2025); // user navigated to March 2025
      service['list'].mockClear();

      store.reload();

      expect(service['list']).toHaveBeenCalledWith(3, 2025);
    });

    it('falls back to the current month when nothing has been loaded yet', () => {
      const now = new Date();
      service['list'].mockReturnValue(of([]));

      store.reload();

      expect(service['list']).toHaveBeenCalledWith(now.getMonth() + 1, now.getFullYear());
    });
  });
});
