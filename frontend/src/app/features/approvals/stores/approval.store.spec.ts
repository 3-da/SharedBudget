import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApprovalStore } from './approval.store';
import { ApprovalService } from '../services/approval.service';
import { SharedExpenseStore } from '../../shared-expenses/stores/shared-expense.store';
import { DashboardStore } from '../../dashboard/stores/dashboard.store';

describe('ApprovalStore', () => {
  let store: ApprovalStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let sharedExpenseStore: { loadExpenses: ReturnType<typeof vi.fn> };
  let dashboardStore: { loadAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      getPending: vi.fn().mockReturnValue(of([])),
      getHistory: vi.fn().mockReturnValue(of([])),
      accept: vi.fn(),
      reject: vi.fn(),
    };
    sharedExpenseStore = { loadExpenses: vi.fn() };
    dashboardStore = { loadAll: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ApprovalStore,
        { provide: ApprovalService, useValue: service },
        { provide: SharedExpenseStore, useValue: sharedExpenseStore },
        { provide: DashboardStore, useValue: dashboardStore },
      ],
    });
    store = TestBed.inject(ApprovalStore);
  });

  const mockApproval = {
    id: 'a-1', expenseId: 'e-1', action: 'CREATE', status: 'PENDING',
    requestedBy: { id: 'u-1', firstName: 'A', lastName: 'B' },
    reviewedBy: null, message: null, proposedData: null,
    createdAt: '2025-01-01', reviewedAt: null,
  };

  it('loadPending sets pending signal', () => {
    service['getPending'].mockReturnValue(of([mockApproval]));
    store.loadPending();
    expect(store.pending()).toEqual([mockApproval]);
    expect(store.loading()).toBe(false);
  });

  it('loadHistory sets history signal', () => {
    service['getHistory'].mockReturnValue(of([mockApproval]));
    store.loadHistory();
    expect(store.history()).toEqual([mockApproval]);
  });

  it('pendingCount returns correct count', () => {
    service['getPending'].mockReturnValue(of([mockApproval, { ...mockApproval, id: 'a-2' }]));
    store.loadPending();
    expect(store.pendingCount()).toBe(2);
  });

  it('pendingExpenseIds returns set of expense IDs', () => {
    const a2 = { ...mockApproval, id: 'a-2', expenseId: 'e-2' };
    const a3 = { ...mockApproval, id: 'a-3', expenseId: null };
    service['getPending'].mockReturnValue(of([mockApproval, a2, a3]));
    store.loadPending();
    const ids = store.pendingExpenseIds();
    expect(ids.has('e-1')).toBe(true);
    expect(ids.has('e-2')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('accept reloads pending, history, and invalidates related stores', () => {
    service['accept'].mockReturnValue(of({ message: 'ok' }));
    store.accept('a-1');
    expect(service['getPending']).toHaveBeenCalled();
    expect(service['getHistory']).toHaveBeenCalled();
    expect(sharedExpenseStore.loadExpenses).toHaveBeenCalled();
    expect(dashboardStore.loadAll).toHaveBeenCalled();
  });

  it('reject reloads pending, history, and invalidates related stores', () => {
    service['reject'].mockReturnValue(of({ message: 'ok' }));
    store.reject('a-1', 'Too expensive');
    expect(service['getPending']).toHaveBeenCalled();
    expect(service['getHistory']).toHaveBeenCalled();
    expect(sharedExpenseStore.loadExpenses).toHaveBeenCalled();
    expect(dashboardStore.loadAll).toHaveBeenCalled();
  });

  it('accept sets error on failure', () => {
    service['accept'].mockReturnValue(throwError(() => ({ error: { message: 'denied' } })));
    store.accept('a-1');
    expect(store.error()).toBe('denied');
    expect(store.loading()).toBe(false);
  });
});
