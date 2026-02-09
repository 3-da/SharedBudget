import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CodeInputComponent } from './code-input.component';

describe('CodeInputComponent', () => {
  let component: CodeInputComponent;
  let fixture: ComponentFixture<CodeInputComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(CodeInputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  function getInputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.digit-input'));
  }

  it('should render 6 digit inputs', () => {
    expect(getInputs().length).toBe(6);
  });

  it('should auto-advance focus on digit input', () => {
    const inputs = getInputs();
    inputs[0].value = '1';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.values()[0]).toBe('1');
  });

  it('should emit codeComplete when all 6 digits entered', () => {
    const spy = vi.fn();
    component.codeComplete.subscribe(spy);
    const newValues = ['1', '2', '3', '4', '5', '6'];
    component.values.set(newValues);

    // Simulate last input
    const inputs = getInputs();
    inputs[5].value = '6';
    inputs[5].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('123456');
  });

  it('should support paste of 6-digit code', () => {
    const spy = vi.fn();
    component.codeComplete.subscribe(spy);

    // jsdom doesn't have ClipboardEvent — call onPaste directly
    const fakeEvent = {
      preventDefault: vi.fn(),
      clipboardData: { getData: () => '654321' },
    } as unknown as ClipboardEvent;

    component.onPaste(fakeEvent);
    fixture.detectChanges();

    expect(component.values()).toEqual(['6', '5', '4', '3', '2', '1']);
    expect(spy).toHaveBeenCalledWith('654321');
  });

  it('should strip non-digit characters from input', () => {
    const inputs = getInputs();
    inputs[0].value = 'a';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(component.values()[0]).toBe('');
  });
});
