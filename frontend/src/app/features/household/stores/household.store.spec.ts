import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HouseholdStore } from './household.store';
import { HouseholdService } from '../services/household.service';
import { InvitationService } from '../services/invitation.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { AuthService } from '../../../core/auth/auth.service';
import { signal } from '@angular/core';

describe('HouseholdStore', () => {
  let store: HouseholdStore;
  let householdService: Record<string, ReturnType<typeof vi.fn>>;
  let invitationService: Record<string, ReturnType<typeof vi.fn>>;
  let dashboardService: Record<string, ReturnType<typeof vi.fn>>;
  let authService: { currentUser: ReturnType<typeof signal> };

  const mockOverview = {
    income: [], totalDefaultIncome: 0, totalCurrentIncome: 0,
    expenses: { personalExpenses: [], sharedExpensesTotal: 0, totalHouseholdExpenses: 0, remainingHouseholdExpenses: 0 },
    savings: { members: [], totalPersonalSavings: 0, totalSharedSavings: 0, totalSavings: 0, totalRemainingBudget: 0 },
    settlement: { amount: 0, owedByUserId: null, owedByFirstName: null, owedToUserId: null, owedToFirstName: null, message: '', isSettled: false, month: 2, year: 2026 },
    pendingApprovalsCount: 0, month: 2, year: 2026,
  };

  beforeEach(() => {
    householdService = {
      getMine: vi.fn(),
      create: vi.fn(),
      joinByCode: vi.fn(),
      regenerateCode: vi.fn(),
      leave: vi.fn(),
      removeMember: vi.fn(),
      transferOwnership: vi.fn(),
    };
    invitationService = { getPending: vi.fn() };
    dashboardService = {
      getOverview: vi.fn().mockReturnValue(of(mockOverview)),
      markSettlementPaid: vi.fn(),
    };
    authService = { currentUser: signal(null) };

    TestBed.configureTestingModule({
      providers: [
        HouseholdStore,
        { provide: HouseholdService, useValue: householdService },
        { provide: InvitationService, useValue: invitationService },
        { provide: DashboardService, useValue: dashboardService },
        { provide: AuthService, useValue: authService },
      ],
    });
    store = TestBed.inject(HouseholdStore);
  });

  const mockHousehold = {
    id: 'h-1', name: 'Test', inviteCode: 'ABC', maxMembers: 2,
    members: [{ id: 'm-1', userId: 'u-1', firstName: 'A', lastName: 'B', role: 'OWNER', joinedAt: '2025-01-01' }],
  };

  it('loadHousehold sets household and loads overview', () => {
    householdService['getMine'].mockReturnValue(of(mockHousehold));
    store.loadHousehold();
    expect(store.household()).toEqual(mockHousehold);
    expect(store.loading()).toBe(false);
    expect(dashboardService['getOverview']).toHaveBeenCalled();
  });

  it('loadHousehold sets null on error', () => {
    householdService['getMine'].mockReturnValue(throwError(() => new Error()));
    store.loadHousehold();
    expect(store.household()).toBeNull();
  });

  it('hasHousehold computed signal', () => {
    expect(store.hasHousehold()).toBe(false);
    householdService['getMine'].mockReturnValue(of(mockHousehold));
    store.loadHousehold();
    expect(store.hasHousehold()).toBe(true);
  });

  it('isOwner returns true when current user is owner', () => {
    authService.currentUser.set({ id: 'u-1' } as any);
    householdService['getMine'].mockReturnValue(of(mockHousehold));
    store.loadHousehold();
    expect(store.isOwner()).toBe(true);
  });

  it('isOwner returns false when no user', () => {
    expect(store.isOwner()).toBe(false);
  });

  it('createHousehold sets household on success', () => {
    householdService['create'].mockReturnValue(of(mockHousehold));
    store.createHousehold('Test');
    expect(store.household()).toEqual(mockHousehold);
  });

  it('joinByCode sets household on success', () => {
    householdService['joinByCode'].mockReturnValue(of(mockHousehold));
    store.joinByCode('ABC');
    expect(store.household()).toEqual(mockHousehold);
  });

  it('leave sets household and overview to null', () => {
    householdService['leave'].mockReturnValue(of({ message: 'ok' }));
    store.leave();
    expect(store.household()).toBeNull();
    expect(store.overview()).toBeNull();
  });

  it('removeMember reloads household', () => {
    householdService['removeMember'].mockReturnValue(of({ message: 'ok' }));
    householdService['getMine'].mockReturnValue(of(mockHousehold));
    store.removeMember('u-2');
    expect(householdService['getMine']).toHaveBeenCalled();
  });

  it('transferOwnership sets household', () => {
    householdService['transferOwnership'].mockReturnValue(of(mockHousehold));
    store.transferOwnership('u-2');
    expect(store.household()).toEqual(mockHousehold);
  });

  it('loadInvitations sets invitations', () => {
    const invs = [{ id: 'i-1' }];
    invitationService['getPending'].mockReturnValue(of(invs));
    store.loadInvitations();
    expect(store.invitations()).toEqual(invs);
  });

  it('markSettlementPaid reloads overview on success', () => {
    dashboardService['markSettlementPaid'].mockReturnValue(of({}));
    store.markSettlementPaid();
    expect(dashboardService['getOverview']).toHaveBeenCalled();
  });

  it('markSettlementPaid sets error on failure', () => {
    dashboardService['markSettlementPaid'].mockReturnValue(throwError(() => ({ error: { message: 'fail' } })));
    store.markSettlementPaid();
    expect(store.error()).toBe('fail');
  });

  it('loadOverview sets overview signal', () => {
    store.loadOverview();
    expect(store.overview()).toEqual(mockOverview);
    expect(store.overviewLoading()).toBe(false);
  });

  it('monthLabel computed from overview', () => {
    store.loadOverview();
    expect(store.monthLabel()).toContain('2026');
  });
});
