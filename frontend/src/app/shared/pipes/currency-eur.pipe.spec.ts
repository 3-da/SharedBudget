import { CurrencyEurPipe } from './currency-eur.pipe';

describe('CurrencyEurPipe', () => {
  const pipe = new CurrencyEurPipe();

  it('should format number as EUR', () => {
    const result = pipe.transform(1234.5);
    expect(result).toContain('1.234,50');
    expect(result).toContain('€');
  });

  it('should return €0.00 for null', () => {
    expect(pipe.transform(null)).toBe('€0.00');
  });

  it('should return €0.00 for undefined', () => {
    expect(pipe.transform(undefined)).toBe('€0.00');
  });

  it('should format zero', () => {
    const result = pipe.transform(0);
    expect(result).toContain('0,00');
    expect(result).toContain('€');
  });

  it('should format negative numbers', () => {
    const result = pipe.transform(-50);
    expect(result).toContain('50,00');
  });
});
