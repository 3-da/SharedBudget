import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatProgressSpinnerModule],
  template: `
    @if (authService.isRestoring()) {
      <div class="app-loading">
        <mat-spinner diameter="48" />
        <p>Loading...</p>
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
    }
  `],
})
export class App {
  readonly authService = inject(AuthService);
}
