import { TestBed } from '@angular/core/testing';
import { PaymentBreakdownComponent } from './payment-breakdown.component';

describe('PaymentBreakdownComponent', () => {
  async function createComponent(paidAmount: number, remainingAmount: number | null) {
    const fixture = TestBed.createComponent(PaymentBreakdownComponent);
    fixture.componentRef.setInput('paidAmount', paidAmount);
    fixture.componentRef.setInput('remainingAmount', remainingAmount);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the paid amount', async () => {
    const fixture = await createComponent(80, 20);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('80');
  });

  it('shows the remaining amount when there is a positive remainder', async () => {
    const fixture = await createComponent(80, 20);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('remaining');
    expect(text).toContain('20');
  });

  it('hides the remaining line when remainingAmount is zero', async () => {
    const fixture = await createComponent(300, 0);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('remaining');
  });

  it('hides the remaining line when remainingAmount is null', async () => {
    const fixture = await createComponent(300, null);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('remaining');
  });
});
