import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AutoFocusDirective } from './auto-focus.directive';

@Component({
  standalone: true,
  imports: [AutoFocusDirective],
  template: `<input appAutoFocus>`,
})
class TestHostComponent {}

describe('AutoFocusDirective', () => {
  it('should focus element after init', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    // Wait for setTimeout(0) in the directive
    await new Promise(resolve => setTimeout(resolve, 10));
    const input = fixture.nativeElement.querySelector('input');
    expect(document.activeElement).toBe(input);
  });
});
