import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="heading-copy">
        <span class="eyebrow">Financial workspace</span>
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
      align-items: flex-end;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: var(--space-md);
    }
    .heading-copy { display: flex; flex-direction: column; }
    .eyebrow { margin-bottom: 7px; color: var(--color-brand); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    h1 { margin: 0; color: var(--color-ink); font-size: clamp(1.75rem, 2vw + 0.75rem, 2.4rem); font-weight: 700; letter-spacing: -0.045em; line-height: 1.1; }
    .subtitle { margin: 8px 0 0; color: var(--color-ink-muted); font-size: clamp(0.82rem, 1vw + 0.45rem, 0.94rem); }
    .actions { display: flex; gap: var(--space-sm); flex-wrap: wrap; align-items: center; }
    @media (max-width: 600px) {
      .page-header { align-items: flex-start; margin-bottom: 22px; }
      .actions { width: 100%; }
    }
  `],
})
export class PageHeaderComponent {
  title = input.required<string>();
  subtitle = input('');
}
