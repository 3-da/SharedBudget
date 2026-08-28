import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="empty-state" role="status">
      <mat-icon class="empty-icon" aria-hidden="true">{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      @if (description()) {
        <p>{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl) var(--space-lg);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-md);
      background: color-mix(in srgb, var(--color-panel) 72%, transparent);
      text-align: center;
      color: var(--color-ink-muted);
    }
    .empty-icon { display: grid; width: 58px; height: 58px; margin-bottom: var(--space-md); place-items: center; border-radius: 18px; background: var(--color-brand-soft); color: var(--color-brand-strong); font-size: 28px; opacity: 1; }
    h3 { margin: 0 0 var(--space-sm); color: var(--color-ink); font-size: 1rem; }
    p { margin: 0; opacity: 0.7; }
  `],
})
export class EmptyStateComponent {
  icon = input('inbox');
  title = input('No data');
  description = input('');
}
