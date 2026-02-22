import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatProgressSpinnerModule, MatProgressBarModule],
  template: `
    @if (authService.isRestoring()) {
      <div class="app-loading">
        @if (showWakeUpHint()) {
          <mat-progress-bar mode="indeterminate" class="wake-bar" />
          <p class="wake-title">Starting up&hellip;</p>
          <p class="wake-hint">The server is waking from sleep (free tier).<br>This may take up to 2&nbsp;minutes on first visit.</p>
        } @else {
          <mat-spinner diameter="48" />
          <p>Loading&hellip;</p>
        }
      </div>
    } @else {
      <router-outlet />
    }
  `,
  styles: [`
    .app-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 16px;
      color: var(--mat-sys-on-surface-variant);
      padding: 24px;
      text-align: center;
    }
    .wake-bar { width: 240px; border-radius: 4px; }
    .wake-title { margin: 0; font-size: 1.1rem; font-weight: 500; color: var(--mat-sys-on-surface); }
    .wake-hint { margin: 0; font-size: 0.875rem; line-height: 1.5; max-width: 300px; }
  `],
})
export class App implements OnInit {
  readonly authService = inject(AuthService);
  readonly showWakeUpHint = signal(false);

  private wakeUpTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Show wake-up hint if session restore takes more than 4 seconds
    this.wakeUpTimer = setTimeout(() => {
      if (this.authService.isRestoring()) this.showWakeUpHint.set(true);
    }, 4000);

    this.authService.restored.then(() => {
      if (this.wakeUpTimer) {
        clearTimeout(this.wakeUpTimer);
        this.wakeUpTimer = null;
      }
      this.showWakeUpHint.set(false);
    });
  }
}
