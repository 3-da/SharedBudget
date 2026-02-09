import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: var(--space-lg);
      flex-wrap: wrap;
      gap: var(--space-md);
    }
    h1 { margin: 0; font-size: 1.75rem; font-weight: 500; }
    .subtitle { margin: var(--space-xs) 0 0; color: var(--mat-sys-on-surface-variant); }
    .actions { display: flex; gap: var(--space-sm); }
  `],
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input('');
}
