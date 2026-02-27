import { Component, computed, output, signal, viewChildren, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-code-input',
  standalone: true,
  template: `
    <div class="code-container">
      @for (i of digits; track i) {
        <input
          #digitInput
          type="text"
          maxlength="1"
          inputmode="numeric"
          class="digit-input"
          [attr.aria-label]="'Digit ' + (i + 1) + ' of 6'"
          [value]="values()[i]"
          (input)="onInput(i, $event)"
          (keydown)="onKeyDown(i, $event)"
          (paste)="onPaste($event)" />
      }
    </div>
  `,
  styles: [`
    .code-container { display: flex; gap: 8px; justify-content: center; }
    .digit-input {
      width: 44px; height: 52px;
      text-align: center; font-size: 1.4rem; font-weight: 500;
      border: 2px solid var(--ion-color-medium);
      border-radius: 8px; outline: none;
      background: var(--ion-background-color);
      color: var(--ion-text-color);
    }
    .digit-input:focus { border-color: var(--ion-color-primary); }
  `],
})
export class CodeInputComponent implements AfterViewInit {
  codeComplete = output<string>();
  readonly digits = [0, 1, 2, 3, 4, 5];
  readonly values = signal<string[]>(['', '', '', '', '', '']);
  private readonly inputs = viewChildren<ElementRef>('digitInput');
  readonly isComplete = computed(() => this.values().join('').length === 6);

  ngAfterViewInit(): void {
    setTimeout(() => this.inputs()[0]?.nativeElement.focus(), 300);
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '');
    const newValues = [...this.values()];
    newValues[index] = val;
    this.values.set(newValues);

    if (val && index < 5) {
      this.inputs()[index + 1]?.nativeElement.focus();
    }
    this.checkComplete();
  }

  onKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.values()[index] && index > 0) {
      this.inputs()[index - 1]?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const paste = event.clipboardData?.getData('text')?.replace(/\D/g, '') || '';
    const newValues = [...this.values()];
    for (let i = 0; i < 6 && i < paste.length; i++) {
      newValues[i] = paste[i];
    }
    this.values.set(newValues);
    const focusIndex = Math.min(paste.length, 5);
    this.inputs()[focusIndex]?.nativeElement.focus();
    this.checkComplete();
  }

  private checkComplete(): void {
    const code = this.values().join('');
    if (code.length === 6) {
      this.codeComplete.emit(code);
    }
  }
}
