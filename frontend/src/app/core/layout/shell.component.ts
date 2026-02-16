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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatSidenavModule, ToolbarComponent, SidenavComponent],
  template: `
    <a href="#main-content" class="skip-link">Skip to main content</a>
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
        <div id="main-content" tabindex="-1" class="content-wrapper">
          <router-outlet />
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .skip-link {
      position: absolute;
      top: -100%;
      left: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      z-index: 9999;
      border-radius: 0 0 4px 4px;
      text-decoration: none;
      &:focus { top: 0; }
    }
    .sidenav-container { flex: 1; }
    .sidenav { width: var(--sidenav-width); }
    .content-wrapper {
      padding: var(--space-lg);
      max-width: var(--content-max-width);
      margin: 0 auto;
    }
    @media (max-width: 1024px) {
      .content-wrapper { padding: var(--space-md); }
    }
    @media (max-width: 600px) {
      .content-wrapper { padding: var(--space-sm); }
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
