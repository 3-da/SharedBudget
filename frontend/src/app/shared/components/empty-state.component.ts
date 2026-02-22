import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  standalone: true,
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
      padding: var(--space-2xl);
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .empty-icon { font-size: 64px; width: 64px; height: 64px; margin-bottom: var(--space-md); opacity: 0.5; }
    h3 { margin: 0 0 var(--space-sm); }
    p { margin: 0; opacity: 0.7; }
  `],
})
export class EmptyStateComponent {
  icon = input('inbox');
  title = input('No data');
  description = input('');
}
