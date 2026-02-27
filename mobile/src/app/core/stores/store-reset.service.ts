import { Injectable } from '@angular/core';

type ResetFn = () => void;

@Injectable({ providedIn: 'root' })
export class StoreResetService {
  private readonly resets: ResetFn[] = [];

  register(fn: ResetFn): void {
    this.resets.push(fn);
  }

  resetAll(): void {
    this.resets.forEach(fn => fn());
  }
}
