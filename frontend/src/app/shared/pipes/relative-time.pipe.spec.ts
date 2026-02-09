import { RelativeTimePipe } from './relative-time.pipe';

describe('RelativeTimePipe', () => {
  const pipe = new RelativeTimePipe();

  it('should return relative string for Date input', () => {
    const date = new Date(Date.now() - 60000 * 5); // 5 min ago
    const result = pipe.transform(date);
    expect(result).toContain('minutes ago');
  });

  it('should parse string input correctly', () => {
    const dateStr = new Date(Date.now() - 60000 * 60).toISOString(); // 1 hour ago
    const result = pipe.transform(dateStr);
    expect(result).toContain('ago');
  });

  it('should return empty string for null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });
});
