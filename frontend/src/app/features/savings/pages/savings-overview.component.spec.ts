import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdStore } from '../../household/stores/household.store';
import { SavingStore } from '../stores/saving.store';
import { SavingsOverviewComponent } from './savings-overview.component';

describe('SavingsOverviewComponent', () => {
  let component: SavingsOverviewComponent;
  let fixture: ComponentFixture<SavingsOverviewComponent>;

  const savingStore = {
    loadMySavings: vi.fn(),
    loadHouseholdSavings: vi.fn(),
    loadSavingsHistory: vi.fn(),
  };
  const householdStore = {
    overview: signal({}),
    loadOverview: vi.fn(),
    setMonth: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SavingsOverviewComponent],
      providers: [
        { provide: SavingStore, useValue: savingStore },
        { provide: HouseholdStore, useValue: householdStore },
        { provide: MatDialog, useValue: { open: vi.fn() } },
      ],
    }).overrideComponent(SavingsOverviewComponent, { set: { template: '' } });

    fixture = TestBed.createComponent(SavingsOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load only the final month after rapid month changes', async () => {
    component.onMonthChange({ month: 9, year: 2026 });
    component.onMonthChange({ month: 10, year: 2026 });
    component.onMonthChange({ month: 11, year: 2026 });

    await vi.advanceTimersByTimeAsync(150);

    expect(savingStore.loadMySavings).toHaveBeenCalledOnce();
    expect(savingStore.loadMySavings).toHaveBeenCalledWith(11, 2026);
    expect(savingStore.loadHouseholdSavings).toHaveBeenCalledOnce();
    expect(savingStore.loadHouseholdSavings).toHaveBeenCalledWith(11, 2026);
    expect(householdStore.setMonth).toHaveBeenCalledOnce();
    expect(householdStore.setMonth).toHaveBeenCalledWith(11, 2026);
  });
});
