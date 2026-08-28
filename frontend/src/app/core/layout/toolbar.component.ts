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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule],
  template: `
    <mat-toolbar class="toolbar">
      <button mat-icon-button class="menu-button" (click)="menuToggle.emit()" aria-label="Toggle navigation menu">
        <mat-icon aria-hidden="true">menu</mat-icon>
      </button>
      <a routerLink="/household" class="brand" aria-label="SharedBudget overview">
        <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
        <span class="brand-copy">
          <strong>SharedBudget</strong>
          <small>Household finance</small>
        </span>
      </a>
      <span class="spacer"></span>
      <button mat-icon-button class="toolbar-action" (click)="themeService.toggle()" [matTooltip]="themeTooltip()" [attr.aria-label]="'Switch to ' + (themeService.isDark() ? 'light' : 'dark') + ' theme'">
        <mat-icon aria-hidden="true">{{ themeIcon() }}</mat-icon>
      </button>
      <button class="profile-button" [matMenuTriggerFor]="userMenu" aria-label="User menu">
        <span class="profile-copy">
          <strong>{{ currentUserDisplayName() }}</strong>
          <small>My account</small>
        </span>
        <span class="avatar" aria-hidden="true">{{ currentUserInitials() }}</span>
        <mat-icon aria-hidden="true">expand_more</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu">
        @if (authService.currentUser(); as user) {
          <div class="user-info" mat-menu-item disabled>
            {{ user.firstName }} {{ user.lastName }}
          </div>
        }
        <button mat-menu-item routerLink="/settings">
          <mat-icon aria-hidden="true">settings</mat-icon>
          <span>Settings</span>
        </button>
        <button mat-menu-item (click)="onLogout()">
          <mat-icon aria-hidden="true">logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      height: var(--toolbar-height);
      padding: 0 26px;
      border-bottom: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-panel) 94%, transparent);
      color: var(--color-ink);
      backdrop-filter: blur(16px);
    }
    .menu-button { display: none; margin-right: 8px; }
    .brand { display: inline-flex; align-items: center; gap: 11px; color: inherit; text-decoration: none; }
    .brand-mark {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 3px;
      padding: 8px;
      border-radius: 11px;
      background: var(--color-ink);
      box-sizing: border-box;
    }
    .brand-mark span { width: 4px; border-radius: 4px; background: white; }
    .brand-mark span:nth-child(1) { height: 8px; opacity: 0.65; }
    .brand-mark span:nth-child(2) { height: 14px; }
    .brand-mark span:nth-child(3) { height: 11px; opacity: 0.82; }
    .brand-copy,
    .profile-copy { display: flex; flex-direction: column; line-height: 1.2; }
    .brand-copy strong { font-size: 0.95rem; letter-spacing: -0.025em; }
    .brand-copy small,
    .profile-copy small { margin-top: 2px; color: var(--color-ink-muted); font-size: 0.68rem; font-weight: 500; }
    .spacer { flex: 1; }
    .toolbar-action { margin-right: 8px; color: var(--color-ink-muted); }
    .profile-button {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 48px;
      padding: 5px 7px 5px 13px;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      background: var(--color-panel-subtle);
      color: var(--color-ink);
      cursor: pointer;
    }
    .profile-copy { align-items: flex-end; }
    .profile-copy strong { max-width: 170px; overflow: hidden; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
    .avatar { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: var(--color-brand-soft); color: var(--color-brand-strong); font-size: 0.72rem; font-weight: 700; }
    .profile-button > mat-icon { width: 18px; height: 18px; color: var(--color-ink-muted); font-size: 18px; }
    .user-info { opacity: 0.7; font-size: 0.875rem; }
    @media (max-width: 1023px) {
      .toolbar { padding: 0 14px; }
      .menu-button { display: inline-flex; }
    }
    @media (max-width: 600px) {
      .brand-copy small,
      .profile-copy,
      .profile-button > mat-icon { display: none; }
      .toolbar-action { margin-right: 2px; }
      .profile-button { min-height: 42px; padding: 3px; border: 0; background: transparent; }
    }
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

  readonly currentUserDisplayName = computed(() => {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return 'Account';

    return `${currentUser.firstName} ${currentUser.lastName}`;
  });

  readonly currentUserInitials = computed(() => {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return 'SB';

    return `${currentUser.firstName[0] ?? ''}${currentUser.lastName[0] ?? ''}`.toUpperCase();
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
