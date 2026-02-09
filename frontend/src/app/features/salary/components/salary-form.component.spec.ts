import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { SalaryFormComponent } from './salary-form.component';

describe('SalaryFormComponent', () => {
  let component: SalaryFormComponent;
  let fixture: ComponentFixture<SalaryFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
    });
    fixture = TestBed.createComponent(SalaryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should have default values of 0', () => {
    expect(component.form.value.defaultAmount).toBe(0);
    expect(component.form.value.currentAmount).toBe(0);
  });

  it('should require min 0 for defaultAmount', () => {
    component.form.patchValue({ defaultAmount: -1 });
    expect(component.form.get('defaultAmount')!.hasError('min')).toBe(true);
  });

  it('should accept valid amount', () => {
    component.form.patchValue({ defaultAmount: 5000, currentAmount: 5000 });
    expect(component.form.valid).toBe(true);
  });

  it('should emit save on valid submit', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({ defaultAmount: 5000, currentAmount: 4500 });
    component.onSubmit();

    expect(spy).toHaveBeenCalledWith({ defaultAmount: 5000, currentAmount: 4500 });
  });

  it('should not emit save when form is invalid', () => {
    const spy = vi.fn();
    component.save.subscribe(spy);

    component.form.patchValue({ defaultAmount: -1 });
    component.onSubmit();

    expect(spy).not.toHaveBeenCalled();
  });
});
