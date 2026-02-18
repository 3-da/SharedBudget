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
    expenses: { personalExpenses: [], sharedExpensesTotal: 0, totalHouseholdExpenses: 1200, remainingHouseholdExpenses: 0 },
    savings: { members: [], totalPersonalSavings: 800, totalSharedSavings: 200, totalSavings: 1000, totalRemainingBudget: 3600 },
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

  describe('computed signals with null overview', () => {
    it('income returns empty array when no overview', () => {
      expect(store.income()).toEqual([]);
    });

    it('totalCurrentIncome returns 0 when no overview', () => {
      expect(store.totalCurrentIncome()).toBe(0);
    });

    it('expenses returns null when no overview', () => {
      expect(store.expenses()).toBeNull();
    });

    it('savings returns null when no overview', () => {
      expect(store.savings()).toBeNull();
    });

    it('settlement returns null when no overview', () => {
      expect(store.settlement()).toBeNull();
    });

    it('pendingApprovalsCount returns 0 when no overview', () => {
      expect(store.pendingApprovalsCount()).toBe(0);
    });
  });

  describe('computed signals with overview loaded', () => {
    beforeEach(() => {
      service['getOverview'].mockReturnValue(of(overview));
      store.loadAll();
    });

    it('expenses returns expenses from overview', () => {
      expect(store.expenses()).toEqual(overview.expenses);
    });

    it('savings returns savings from overview', () => {
      expect(store.savings()).toEqual(overview.savings);
    });

    it('settlement returns settlement from overview', () => {
      expect(store.settlement()).toEqual(overview.settlement);
    });

    it('pendingApprovalsCount returns count from overview', () => {
      expect(store.pendingApprovalsCount()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear overview, loading and error', () => {
      service['getOverview'].mockReturnValue(of(overview));
      store.loadAll();
      store.reset();
      expect(store.overview()).toBeNull();
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });

  describe('loadAll lazy loading', () => {
    it('should set loading=true on first load when no overview', () => {
      let capturedLoading = false;
      service['getOverview'].mockImplementation(() => {
        capturedLoading = store.loading();
        return of(overview);
      });
      store.loadAll();
      expect(capturedLoading).toBe(true);
    });

    it('should NOT set loading=true when overview already exists', () => {
      service['getOverview'].mockReturnValue(of(overview));
      store.loadAll();
      let capturedLoading = false;
      service['getOverview'].mockImplementation(() => {
        capturedLoading = store.loading();
        return of(overview);
      });
      store.loadAll();
      expect(capturedLoading).toBe(false);
    });

    it('should clear error on each loadAll call', () => {
      service['getOverview'].mockReturnValue(throwError(() => new Error()));
      store.loadAll();
      service['getOverview'].mockReturnValue(of(overview));
      store.loadAll();
      expect(store.error()).toBeNull();
    });
  });

  describe('markPaid clears error on success', () => {
    it('should reload and have null error after markPaid success', () => {
      service['markSettlementPaid'].mockReturnValue(of({}));
      service['getOverview'].mockReturnValue(of(overview));
      // First set an error
      store['error'].set('some error');
      store.markPaid();
      // After reload, error is cleared by loadAll → error.set(null)
      expect(store.error()).toBeNull();
    });
  });
});
