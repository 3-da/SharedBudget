import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    h1 { margin: 0; font-size: clamp(1.25rem, 2vw + 0.5rem, 1.75rem); font-weight: 500; }
    .subtitle { margin: var(--space-xs) 0 0; color: var(--mat-sys-on-surface-variant); font-size: clamp(0.8rem, 1vw + 0.5rem, 0.95rem); }
    .actions { display: flex; gap: var(--space-sm); flex-wrap: wrap; align-items: center; }
    @media (max-width: 600px) {
      .page-header { margin-bottom: var(--space-md); }
    }
  `],
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input('');
}
