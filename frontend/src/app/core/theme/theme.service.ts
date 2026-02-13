import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sb-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly mode = signal<ThemeMode>(this.loadSaved());
  readonly isDark = signal(false);

  constructor() {
    // React to mode changes and apply the class
    effect(() => {
      const mode = this.mode();
      this.persist(mode);
      const dark = mode === 'dark' || (mode === 'system' && this.prefersDark());
      this.isDark.set(dark);
      if (this.isBrowser) {
        document.documentElement.classList.toggle('dark-theme', dark);
      }
    });

    // Listen for system preference changes
    if (this.isBrowser) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.mode() === 'system') {
          const dark = this.prefersDark();
          this.isDark.set(dark);
          document.documentElement.classList.toggle('dark-theme', dark);
        }
      });
    }
  }

  toggle(): void {
    const current = this.mode();
    if (current === 'light') this.mode.set('dark');
    else if (current === 'dark') this.mode.set('system');
    else this.mode.set('light');
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private prefersDark(): boolean {
    return this.isBrowser && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private loadSaved(): ThemeMode {
    if (!this.isBrowser) return 'system';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  }

  private persist(mode: ThemeMode): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }
}
