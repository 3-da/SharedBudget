import { Directive, HostListener } from '@angular/core';

@Directive({ selector: '[appPositiveNumber]', standalone: true })
export class PositiveNumberDirective {
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End', '.'];
    if (allowed.includes(event.key) || /^[0-9]$/.test(event.key)) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key)) {
      return;
    }
    event.preventDefault();
  }
}
