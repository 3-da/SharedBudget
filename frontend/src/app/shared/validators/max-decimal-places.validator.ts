import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Rejects a value with more decimal places than allowed. Mirrors the backend's
 * @IsNumber({ maxDecimalPlaces }) rule so money inputs reject sub-cent amounts
 * inline instead of failing only after a 400 comes back from the API.
 */
export function maxDecimalPlacesValidator(maxDecimalPlaces = 2): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    const decimalPlaces = (String(value).split('.')[1] ?? '').length;
    return decimalPlaces > maxDecimalPlaces ? { maxDecimalPlaces: { max: maxDecimalPlaces, actual: decimalPlaces } } : null;
  };
}
