import { ChangeDetectionStrategy, Component, inject, viewChild, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { ToolbarComponent } from './toolbar.component';
import { SidenavComponent } from './sidenav.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatSidenavModule, ToolbarComponent, SidenavComponent],
  template: `
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <div class="application-frame">
      <app-toolbar (menuToggle)="sidenavEl()?.toggle()" />
      <mat-sidenav-container class="sidenav-container">
      <mat-sidenav
        #sidenavRef
        [mode]="isDesktop() ? 'side' : 'over'"
        [opened]="isDesktop()"
        class="sidenav">
        <app-sidenav (navClick)="onNavClick()" />
      </mat-sidenav>
        <mat-sidenav-content class="content">
          <main id="main-content" tabindex="-1" class="content-wrapper">
            <router-outlet />
          </main>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .application-frame { display: flex; flex-direction: column; min-height: 100%; background: var(--color-canvas); }
    .skip-link {
      position: absolute;
      top: -100%;
      left: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      z-index: 9999;
      border-radius: 0 0 var(--radius-sm) var(--radius-sm);
      text-decoration: none;
      &:focus { top: 0; }
    }
    .sidenav-container { flex: 1; background: transparent; }
    .sidenav {
      width: var(--sidenav-width);
      border-right: 1px solid var(--color-border);
      border-radius: 0;
      background: var(--color-panel);
    }
    .content { background: var(--color-canvas); }
    .content-wrapper {
      padding: 38px 40px 56px;
      max-width: var(--content-max-width);
      margin: 0 auto;
      outline: none;
    }
    @media (max-width: 1024px) {
      .content-wrapper { padding: 28px 24px 48px; }
    }
    @media (max-width: 600px) {
      .content-wrapper { padding: 22px 14px 40px; }
    }
  `],
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly sidenavEl = viewChild<MatSidenav>('sidenavRef');

  readonly isDesktop = toSignal(
    this.breakpointObserver.observe('(min-width: 1024px)').pipe(
      map(result => result.matches),
    ),
    { initialValue: false },
  );

  onNavClick(): void {
    if (!this.isDesktop()) {
      this.sidenavEl()?.close();
    }
  }
}
