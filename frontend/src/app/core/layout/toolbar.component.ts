import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../theme/theme.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule],
  template: `
    <mat-toolbar color="primary" class="toolbar">
      <button mat-icon-button (click)="menuToggle.emit()">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="app-name">SharedBudget</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="themeService.toggle()" [matTooltip]="themeTooltip()">
        <mat-icon>{{ themeIcon() }}</mat-icon>
      </button>
      <button mat-icon-button [matMenuTriggerFor]="userMenu" aria-label="User menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu">
        @if (authService.currentUser(); as user) {
          <div class="user-info" mat-menu-item disabled>
            {{ user.firstName }} {{ user.lastName }}
          </div>
        }
        <button mat-menu-item routerLink="/settings">
          <mat-icon>settings</mat-icon>
          <span>Settings</span>
        </button>
        <button mat-menu-item (click)="onLogout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .toolbar { position: sticky; top: 0; z-index: 100; }
    .app-name { margin-left: var(--space-sm); font-weight: 500; }
    .spacer { flex: 1; }
    .user-info { opacity: 0.7; font-size: 0.875rem; }
  `],
})
export class ToolbarComponent {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  menuToggle = output();

  readonly themeIcon = computed(() => {
    const mode = this.themeService.mode();
    if (mode === 'light') return 'light_mode';
    if (mode === 'dark') return 'dark_mode';
    return 'brightness_auto';
  });

  readonly themeTooltip = computed(() => {
    const mode = this.themeService.mode();
    if (mode === 'light') return 'Switch to dark mode';
    if (mode === 'dark') return 'Switch to system';
    return 'Switch to light mode';
  });

  onLogout(): void {
    this.authService.logout().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      error: () => {
        this.authService.clearAuth();
        this.router.navigate(['/auth/login']);
      },
    });
  }
}
