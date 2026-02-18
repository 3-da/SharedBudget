import { TestBed } from '@angular/core/testing';
import { NotificationStore } from './notification.store';

describe('NotificationStore', () => {
  let store: NotificationStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [NotificationStore] });
    store = TestBed.inject(NotificationStore);
  });

  it('should initialise with pendingApprovalsCount = 0', () => {
    expect(store.pendingApprovalsCount()).toBe(0);
  });

  describe('setPendingApprovalsCount', () => {
    it('should update count', () => {
      store.setPendingApprovalsCount(5);
      expect(store.pendingApprovalsCount()).toBe(5);
    });

    it('should update count to 0', () => {
      store.setPendingApprovalsCount(3);
      store.setPendingApprovalsCount(0);
      expect(store.pendingApprovalsCount()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset count to 0', () => {
      store.setPendingApprovalsCount(7);
      store.reset();
      expect(store.pendingApprovalsCount()).toBe(0);
    });
  });
});
