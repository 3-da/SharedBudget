import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PositiveNumberDirective } from './positive-number.directive';

@Component({
  standalone: true,
  imports: [PositiveNumberDirective],
  template: `<input appPositiveNumber>`,
})
class TestHostComponent {}

describe('PositiveNumberDirective', () => {
  let input: HTMLInputElement;

  beforeEach(async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  function dispatchKey(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    input.dispatchEvent(event);
    return event;
  }

  it('should allow digit keys', () => {
    const event = dispatchKey('5');
    expect(event.defaultPrevented).toBe(false);
  });

  it('should allow Backspace', () => {
    const event = dispatchKey('Backspace');
    expect(event.defaultPrevented).toBe(false);
  });

  it('should allow Tab', () => {
    const event = dispatchKey('Tab');
    expect(event.defaultPrevented).toBe(false);
  });

  it('should allow arrow keys', () => {
    expect(dispatchKey('ArrowLeft').defaultPrevented).toBe(false);
    expect(dispatchKey('ArrowRight').defaultPrevented).toBe(false);
  });

  it('should allow decimal point', () => {
    expect(dispatchKey('.').defaultPrevented).toBe(false);
  });

  it('should block letters', () => {
    expect(dispatchKey('a').defaultPrevented).toBe(true);
    expect(dispatchKey('z').defaultPrevented).toBe(true);
  });

  it('should block minus sign', () => {
    expect(dispatchKey('-').defaultPrevented).toBe(true);
  });

  it('should block special characters', () => {
    expect(dispatchKey('!').defaultPrevented).toBe(true);
    expect(dispatchKey('@').defaultPrevented).toBe(true);
  });

  it('should allow Ctrl+A/C/V/X', () => {
    expect(dispatchKey('a', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatchKey('c', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatchKey('v', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(dispatchKey('x', { ctrlKey: true }).defaultPrevented).toBe(false);
  });
});
