import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ExpenseFormComponent } from './expense-form.component';

describe('ExpenseFormComponent', () => {
  let component: ExpenseFormComponent;
  let fixture: ComponentFixture<ExpenseFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
    });
    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with default form values', () => {
    expect(component.form.value.category).toBe('RECURRING');
    expect(component.form.value.frequency).toBe('MONTHLY');
  });

  it('should not emit save when form is invalid', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);
    component.onSubmit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit correct DTO for monthly recurring expense', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      name: 'Rent',
      amount: 1000,
      category: 'RECURRING',
      frequency: 'MONTHLY',
    });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith({
      name: 'Rent',
      amount: 1000,
      category: 'RECURRING',
      frequency: 'MONTHLY',
    });
  });

  it('should include yearlyPaymentStrategy for yearly expenses', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      name: 'Insurance',
      amount: 1200,
      category: 'RECURRING',
      frequency: 'YEARLY',
      yearlyPaymentStrategy: 'FULL',
      paymentMonth: 6,
    });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      yearlyPaymentStrategy: 'FULL',
      paymentMonth: 6,
    }));
  });

  it('should include month/year for one-time expenses', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      name: 'Gift',
      amount: 50,
      category: 'ONE_TIME',
      frequency: 'MONTHLY',
      month: 12,
      year: 2025,
    });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      month: 12,
      year: 2025,
    }));
  });

  it('should include paidByUserId when set', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      name: 'Groceries',
      amount: 200,
      category: 'RECURRING',
      frequency: 'MONTHLY',
      paidByUserId: 'user-123',
    });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      paidByUserId: 'user-123',
    }));
  });

  it('should not include paidByUserId when null', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({
      name: 'Rent',
      amount: 1000,
      category: 'RECURRING',
      frequency: 'MONTHLY',
      paidByUserId: null,
    });
    component.onSubmit();

    const dto = spy.mock.calls[0][0];
    expect(dto.paidByUserId).toBeUndefined();
  });
});
