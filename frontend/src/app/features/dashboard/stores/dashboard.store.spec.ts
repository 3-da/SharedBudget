import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardStore } from './dashboard.store';
import { DashboardService } from '../services/dashboard.service';

describe('DashboardStore', () => {
  let store: DashboardStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    service = {
      getOverview: vi.fn(),
      markSettlementPaid: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: DashboardService, useValue: service }],
    });
    store = TestBed.inject(DashboardStore);
  });

  const overview = {
    income: [{ userId: 'u1', firstName: 'Alex', lastName: 'A', defaultSalary: 5000, currentSalary: 4800 }],
    totalDefaultIncome: 5000,
    totalCurrentIncome: 4800,
    expenses: { personalExpenses: [], sharedExpensesTotal: 0, totalHouseholdExpenses: 1200 },
    savings: { members: [], totalDefaultSavings: 3800, totalCurrentSavings: 3600 },
    settlement: { amount: 0, owedByUserId: null, owedByFirstName: null, owedToUserId: null, owedToFirstName: null, message: 'Balanced', isSettled: false, month: 2, year: 2026 },
    pendingApprovalsCount: 0,
    month: 2,
    year: 2026,
  };

  it('loadAll sets overview and computed signals', () => {
    service['getOverview'].mockReturnValue(of(overview));
    store.loadAll();
    expect(store.overview()).toEqual(overview);
    expect(store.loading()).toBe(false);
    expect(store.income().length).toBe(1);
    expect(store.totalCurrentIncome()).toBe(4800);
  });

  it('loadAll sets null overview on error', () => {
    service['getOverview'].mockReturnValue(throwError(() => new Error()));
    store.loadAll();
    expect(store.overview()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('markPaid reloads data on success', () => {
    service['markSettlementPaid'].mockReturnValue(of({}));
    service['getOverview'].mockReturnValue(of(overview));
    store.markPaid();
    expect(service['getOverview']).toHaveBeenCalled();
  });

  it('markPaid sets error on failure', () => {
    service['markSettlementPaid'].mockReturnValue(throwError(() => ({ error: { message: 'Already settled' } })));
    store.markPaid();
    expect(store.error()).toBe('Already settled');
  });
});
