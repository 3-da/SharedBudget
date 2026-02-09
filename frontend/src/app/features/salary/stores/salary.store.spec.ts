import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SalaryStore } from './salary.store';
import { SalaryService } from '../services/salary.service';
import { MatSnackBar } from '@angular/material/snack-bar';

describe('SalaryStore', () => {
  let store: SalaryStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      getMine: vi.fn(),
      getMyYearly: vi.fn(),
      getHousehold: vi.fn(),
      upsert: vi.fn(),
      getByMonth: vi.fn(),
    };
    snackBar = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        SalaryStore,
        { provide: SalaryService, useValue: service },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    store = TestBed.inject(SalaryStore);
  });

  const salary = { id: 's-1', defaultAmount: 5000, currentAmount: 5000, month: 3, year: 2025 };

  it('loadMySalary sets mySalary signal', () => {
    service['getMine'].mockReturnValue(of(salary));
    store.loadMySalary();
    expect(store.mySalary()).toEqual(salary);
    expect(store.loading()).toBe(false);
  });

  it('loadMySalary sets null on error', () => {
    service['getMine'].mockReturnValue(throwError(() => new Error()));
    store.loadMySalary();
    expect(store.mySalary()).toBeNull();
  });

  it('loadYearlySalaries sets yearlySalaries signal', () => {
    service['getMyYearly'].mockReturnValue(of([salary]));
    store.loadYearlySalaries(2025);
    expect(store.yearlySalaries()).toEqual([salary]);
  });

  it('loadYearlySalaries sets empty array on error', () => {
    service['getMyYearly'].mockReturnValue(throwError(() => new Error()));
    store.loadYearlySalaries(2025);
    expect(store.yearlySalaries()).toEqual([]);
  });

  it('upsert sets mySalary and shows snackbar', () => {
    service['upsert'].mockReturnValue(of(salary));
    service['getMyYearly'].mockReturnValue(of([salary]));
    store.upsert({ defaultAmount: 5000, currentAmount: 5000 });
    expect(store.mySalary()).toEqual(salary);
    expect(snackBar.open).toHaveBeenCalledWith('Salary saved', '', { duration: 3000 });
  });

  it('upsert sets error on failure', () => {
    service['upsert'].mockReturnValue(throwError(() => ({ error: { message: 'fail' } })));
    store.upsert({ defaultAmount: 5000, currentAmount: 5000 });
    expect(store.error()).toBe('fail');
  });
});
