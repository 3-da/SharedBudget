import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PasswordFieldComponent } from './password-field.component';

@Component({
  standalone: true,
  imports: [PasswordFieldComponent],
  template: `<app-password-field [control]="ctrl" />`,
})
class TestHostComponent {
  ctrl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

describe('PasswordFieldComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should render input with type=password initially', () => {
    const input = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('password');
  });

  it('should toggle to text type on visibility button click', () => {
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('text');
  });

  it('should toggle back to password on second click', () => {
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.type).toBe('password');
  });
});
