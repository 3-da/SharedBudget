import { FormControl } from '@angular/forms';
import { maxDecimalPlacesValidator } from './max-decimal-places.validator';

describe('maxDecimalPlacesValidator', () => {
  const validator = maxDecimalPlacesValidator(2);

  it('accepts a whole number', () => {
    const control = new FormControl(50);
    expect(validator(control)).toBeNull();
  });

  it('accepts a value with exactly 2 decimal places', () => {
    const control = new FormControl(49.99);
    expect(validator(control)).toBeNull();
  });

  it('accepts a value with 1 decimal place', () => {
    const control = new FormControl(49.9);
    expect(validator(control)).toBeNull();
  });

  it('rejects a value with more than 2 decimal places', () => {
    const control = new FormControl(49.995);
    expect(validator(control)).toEqual({ maxDecimalPlaces: { max: 2, actual: 3 } });
  });

  it('accepts null, undefined, and empty string (defers to Validators.required)', () => {
    expect(validator(new FormControl(null))).toBeNull();
    expect(validator(new FormControl(undefined))).toBeNull();
    expect(validator(new FormControl(''))).toBeNull();
  });

  it('respects a custom maxDecimalPlaces argument', () => {
    const strict = maxDecimalPlacesValidator(0);
    expect(strict(new FormControl(50))).toBeNull();
    expect(strict(new FormControl(50.5))).toEqual({ maxDecimalPlaces: { max: 0, actual: 1 } });
  });
});
