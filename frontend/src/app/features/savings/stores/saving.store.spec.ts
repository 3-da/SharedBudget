import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SavingStore } from './saving.store';
import { SavingService } from '../services/saving.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { Saving } from '../../../shared/models/saving.model';

describe('SavingStore', () => {
  let store: SavingStore;
  let savingService: Record<string, ReturnType<typeof vi.fn>>;
  let dashboardService: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: Record<string, ReturnType<typeof vi.fn>>;

  const personalSaving: Saving = {
    id: 's1', userId: 'u1', householdId: 'h1',
    amount: 500, month: 2, year: 2026, isShared: false,
    createdAt: '', updatedAt: '',
  };
  const sharedSaving: Saving = {
    id: 's2', userId: 'u1', householdId: 'h1',
    amount: 300, month: 2, year: 2026, isShared: true,
    createdAt: '', updatedAt: '',
  };
  const householdSaving: Saving = {
    id: 's3', userId: 'u2', householdId: 'h1',
    amount: 200, month: 2, year: 2026, isShared: false,
    createdAt: '', updatedAt: '',
  };
  const historyItem = { month: 1, year: 2026, totalPersonalSavings: 400, totalSharedSavings: 100, totalSavings: 500 };

  beforeEach(() => {
    savingService = {
      getMine: vi.fn(),
      getHousehold: vi.fn(),
      addPersonal: vi.fn(),
      withdrawPersonal: vi.fn(),
      addShared: vi.fn(),
      withdrawShared: vi.fn(),
    };
    dashboardService = {
      getSavingsHistory: vi.fn(),
      getOverview: vi.fn(),
      markSettlementPaid: vi.fn(),
    };
    snackBar = { open: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SavingStore,
        { provide: SavingService, useValue: savingService },
        { provide: DashboardService, useValue: dashboardService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    store = TestBed.inject(SavingStore);
  });

  it('should initialise with empty state', () => {
    expect(store.mySavings()).toEqual([]);
    expect(store.householdSavings()).toEqual([]);
    expect(store.savingsHistory()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  describe('computed signals', () => {
    beforeEach(() => {
      savingService['getMine'].mockReturnValue(of([personalSaving, sharedSaving]));
      store.loadMySavings();
    });

    it('personalSaving returns the non-shared saving', () => {
      expect(store.personalSaving()).toEqual(personalSaving);
    });

    it('sharedSaving returns the shared saving', () => {
      expect(store.sharedSaving()).toEqual(sharedSaving);
    });

    it('totalPersonal returns personal saving amount', () => {
      expect(store.totalPersonal()).toBe(500);
    });

    it('totalShared returns shared saving amount', () => {
      expect(store.totalShared()).toBe(300);
    });

    it('personalSaving returns null when no personal saving exists', () => {
      savingService['getMine'].mockReturnValue(of([sharedSaving]));
      store.loadMySavings();
      expect(store.personalSaving()).toBeNull();
      expect(store.totalPersonal()).toBe(0);
    });

    it('sharedSaving returns null when no shared saving exists', () => {
      savingService['getMine'].mockReturnValue(of([personalSaving]));
      store.loadMySavings();
      expect(store.sharedSaving()).toBeNull();
      expect(store.totalShared()).toBe(0);
    });
  });

  describe('totalHousehold', () => {
    it('sums all household savings', () => {
      savingService['getHousehold'].mockReturnValue(of([personalSaving, householdSaving]));
      store.loadHouseholdSavings();
      expect(store.totalHousehold()).toBe(700);
    });

    it('returns 0 when no household savings', () => {
      expect(store.totalHousehold()).toBe(0);
    });
  });

  describe('loadMySavings', () => {
    it('should set mySavings on success', () => {
      savingService['getMine'].mockReturnValue(of([personalSaving]));
      store.loadMySavings();
      expect(store.mySavings()).toEqual([personalSaving]);
      expect(store.loading()).toBe(false);
    });

    it('should show spinner on first load (empty)', () => {
      let capturedLoading = false;
      savingService['getMine'].mockImplementation(() => {
        capturedLoading = store.loading();
        return of([personalSaving]);
      });
      store.loadMySavings();
      expect(capturedLoading).toBe(true);
      expect(store.loading()).toBe(false);
    });

    it('should NOT show spinner when savings already loaded', () => {
      savingService['getMine'].mockReturnValue(of([personalSaving]));
      store.loadMySavings();
      let capturedLoading = false;
      savingService['getMine'].mockImplementation(() => {
        capturedLoading = store.loading();
        return of([personalSaving]);
      });
      store.loadMySavings();
      expect(capturedLoading).toBe(false);
    });

    it('should set empty array on error', () => {
      savingService['getMine'].mockReturnValue(throwError(() => new Error()));
      store.loadMySavings();
      expect(store.mySavings()).toEqual([]);
      expect(store.loading()).toBe(false);
    });

    it('should pass month and year params', () => {
      savingService['getMine'].mockReturnValue(of([]));
      store.loadMySavings(3, 2025);
      expect(savingService['getMine']).toHaveBeenCalledWith(3, 2025);
    });
  });

  describe('loadHouseholdSavings', () => {
    it('should set householdSavings on success', () => {
      savingService['getHousehold'].mockReturnValue(of([householdSaving]));
      store.loadHouseholdSavings();
      expect(store.householdSavings()).toEqual([householdSaving]);
    });

    it('should set empty array on error', () => {
      savingService['getHousehold'].mockReturnValue(throwError(() => new Error()));
      store.loadHouseholdSavings();
      expect(store.householdSavings()).toEqual([]);
    });
  });

  describe('loadSavingsHistory', () => {
    it('should set savingsHistory on success', () => {
      dashboardService['getSavingsHistory'].mockReturnValue(of([historyItem]));
      store.loadSavingsHistory();
      expect(store.savingsHistory()).toEqual([historyItem]);
    });

    it('should set empty array on error', () => {
      dashboardService['getSavingsHistory'].mockReturnValue(throwError(() => new Error()));
      store.loadSavingsHistory();
      expect(store.savingsHistory()).toEqual([]);
    });
  });

  describe('addPersonal', () => {
    const dto = { amount: 50, month: 2, year: 2026 };

    beforeEach(() => {
      savingService['getMine'].mockReturnValue(of([]));
      savingService['getHousehold'].mockReturnValue(of([]));
      dashboardService['getSavingsHistory'].mockReturnValue(of([]));
    });

    it('should show success snackbar and reload on success', () => {
      savingService['addPersonal'].mockReturnValue(of(personalSaving));
      store.addPersonal(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Savings added', '', { duration: 3000 });
      expect(savingService['getMine']).toHaveBeenCalled();
    });

    it('should call onSuccess callback', () => {
      savingService['addPersonal'].mockReturnValue(of(personalSaving));
      const onSuccess = vi.fn();
      store.addPersonal(dto, onSuccess);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should show error snackbar and set error on failure', () => {
      savingService['addPersonal'].mockReturnValue(throwError(() => ({ error: { message: 'Limit exceeded' } })));
      store.addPersonal(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Limit exceeded', '', { duration: 4000 });
      expect(store.error()).toBe('Limit exceeded');
    });

    it('should show fallback message if error has no message', () => {
      savingService['addPersonal'].mockReturnValue(throwError(() => ({ error: {} })));
      store.addPersonal(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Failed', '', { duration: 4000 });
    });
  });

  describe('withdrawPersonal', () => {
    const dto = { amount: 50, month: 2, year: 2026 };

    beforeEach(() => {
      savingService['getMine'].mockReturnValue(of([]));
      savingService['getHousehold'].mockReturnValue(of([]));
      dashboardService['getSavingsHistory'].mockReturnValue(of([]));
    });

    it('should show success snackbar and reload on success', () => {
      savingService['withdrawPersonal'].mockReturnValue(of(personalSaving));
      store.withdrawPersonal(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Savings withdrawn', '', { duration: 3000 });
      expect(savingService['getMine']).toHaveBeenCalled();
    });

    it('should show error snackbar on failure', () => {
      savingService['withdrawPersonal'].mockReturnValue(throwError(() => ({ error: { message: 'Exceeds savings' } })));
      store.withdrawPersonal(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Exceeds savings', '', { duration: 4000 });
    });
  });

  describe('addShared', () => {
    const dto = { amount: 50, month: 2, year: 2026 };

    beforeEach(() => {
      savingService['getMine'].mockReturnValue(of([]));
      savingService['getHousehold'].mockReturnValue(of([]));
      dashboardService['getSavingsHistory'].mockReturnValue(of([]));
    });

    it('should show success snackbar and reload on success', () => {
      savingService['addShared'].mockReturnValue(of(sharedSaving));
      store.addShared(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Shared savings added', '', { duration: 3000 });
    });

    it('should show error snackbar on failure', () => {
      savingService['addShared'].mockReturnValue(throwError(() => ({ error: { message: 'Bad request' } })));
      store.addShared(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Bad request', '', { duration: 4000 });
    });
  });

  describe('withdrawShared', () => {
    const dto = { amount: 50, month: 2, year: 2026 };

    beforeEach(() => {
      savingService['getMine'].mockReturnValue(of([]));
      savingService['getHousehold'].mockReturnValue(of([]));
    });

    it('should show approval snackbar and reload on success', () => {
      savingService['withdrawShared'].mockReturnValue(of({ approvalId: 'a1', message: 'Withdrawal request submitted for approval' }));
      store.withdrawShared(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Withdrawal request submitted for approval', '', { duration: 4000 });
    });

    it('should show error snackbar on failure', () => {
      savingService['withdrawShared'].mockReturnValue(throwError(() => ({ error: { message: 'Exceeds shared savings' } })));
      store.withdrawShared(dto);
      expect(snackBar['open']).toHaveBeenCalledWith('Exceeds shared savings', '', { duration: 4000 });
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      savingService['getMine'].mockReturnValue(of([personalSaving]));
      store.loadMySavings();
      store.reset();
      expect(store.mySavings()).toEqual([]);
      expect(store.householdSavings()).toEqual([]);
      expect(store.savingsHistory()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
    });
  });
});
