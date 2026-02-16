import { Component, input, output, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CdkOverlayOrigin, CdkConnectedOverlay } from '@angular/cdk/overlay';

@Component({
  selector: 'app-month-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="month-picker-inline">
      <button mat-icon-button [disabled]="!canGoPrev()" (click)="prevMonth()" aria-label="Previous month">
        <mat-icon aria-hidden="true">chevron_left</mat-icon>
      </button>
      <button class="month-label" cdkOverlayOrigin #trigger="cdkOverlayOrigin" (click)="toggleOverlay()">
        {{ displayLabel() }}
        <mat-icon class="dropdown-icon" aria-hidden="true">arrow_drop_down</mat-icon>
      </button>
      <button mat-icon-button [disabled]="!canGoNext()" (click)="nextMonth()" aria-label="Next month">
        <mat-icon aria-hidden="true">chevron_right</mat-icon>
      </button>
    </div>

    <ng-template cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="trigger"
      [cdkConnectedOverlayOpen]="overlayOpen()"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="overlayOpen.set(false)">
      <div class="month-overlay">
        <div class="overlay-header">
          <button mat-icon-button [disabled]="!canPrevYear()" (click)="prevYear()" aria-label="Previous year">
            <mat-icon aria-hidden="true">chevron_left</mat-icon>
          </button>
          <span class="year-label">{{ overlayYear() }}</span>
          <button mat-icon-button [disabled]="!canNextYear()" (click)="nextYear()" aria-label="Next year">
            <mat-icon aria-hidden="true">chevron_right</mat-icon>
          </button>
        </div>
        <div class="month-grid">
          @for (m of monthItems(); track m.value) {
            <button class="month-cell"
              [class.selected]="m.value === selectedMonth() && overlayYear() === selectedYear()"
              [class.today]="m.value === todayMonth && overlayYear() === todayYear && !(m.value === selectedMonth() && overlayYear() === selectedYear())"
              [class.disabled]="!m.inRange"
              [disabled]="!m.inRange"
              (click)="selectMonth(m.value)">
              {{ m.label }}
            </button>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .month-picker-inline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--mat-sys-surface-container);
      border-radius: 20px;
      padding: 0 4px;
      height: 40px;
    }
    .month-label {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: none;
      background: none;
      cursor: pointer;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
      padding: 4px 8px;
      border-radius: 16px;
      transition: background 150ms;
    }
    .month-label:hover { background: var(--mat-sys-surface-container-highest); }
    .dropdown-icon { font-size: 18px; width: 18px; height: 18px; }
    .month-overlay {
      background: var(--mat-sys-surface-container-low);
      border-radius: 16px;
      padding: 16px;
      box-shadow: var(--mat-sys-level3);
      min-width: 260px;
      animation: overlay-in 200ms ease-out;
    }
    @keyframes overlay-in {
      from { opacity: 0; transform: scaleY(0.9); }
      to { opacity: 1; transform: scaleY(1); }
    }
    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .year-label { font: var(--mat-sys-title-medium); color: var(--mat-sys-on-surface); }
    .month-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
    }
    .month-cell {
      border: none;
      background: none;
      cursor: pointer;
      padding: 8px 4px;
      border-radius: 18px;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface);
      transition: background 150ms;
    }
    .month-cell:hover:not(.disabled) { background: var(--mat-sys-surface-container-highest); }
    .month-cell.selected {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .month-cell.today {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .month-cell.disabled {
      opacity: 0.38;
      cursor: default;
      pointer-events: none;
    }
  `],
})
export class MonthPickerComponent {
  readonly selectedMonth = input(new Date().getMonth() + 1);
  readonly selectedYear = input(new Date().getFullYear());
  readonly monthChange = output<{ month: number; year: number }>();

  readonly overlayOpen = signal(false);
  readonly overlayYear = signal(new Date().getFullYear());

  readonly todayMonth = new Date().getMonth() + 1;
  readonly todayYear = new Date().getFullYear();

  private readonly minDate = computed(() => {
    let m = this.todayMonth - 12;
    let y = this.todayYear;
    if (m <= 0) { m += 12; y -= 1; }
    return { month: m, year: y };
  });

  private readonly maxDate = computed(() => {
    let m = this.todayMonth + 12;
    let y = this.todayYear;
    if (m > 12) { m -= 12; y += 1; }
    return { month: m, year: y };
  });

  readonly displayLabel = computed(() =>
    new Date(this.selectedYear(), this.selectedMonth() - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );

  readonly canGoPrev = computed(() => {
    const min = this.minDate();
    const total = this.selectedYear() * 12 + this.selectedMonth();
    const minTotal = min.year * 12 + min.month;
    return total > minTotal;
  });

  readonly canGoNext = computed(() => {
    const max = this.maxDate();
    const total = this.selectedYear() * 12 + this.selectedMonth();
    const maxTotal = max.year * 12 + max.month;
    return total < maxTotal;
  });

  readonly canPrevYear = computed(() => this.overlayYear() > this.minDate().year);
  readonly canNextYear = computed(() => this.overlayYear() < this.maxDate().year);

  readonly monthItems = computed(() => {
    const min = this.minDate();
    const max = this.maxDate();
    const yr = this.overlayYear();
    const minTotal = min.year * 12 + min.month;
    const maxTotal = max.year * 12 + max.month;

    return Array.from({ length: 12 }, (_, i) => {
      const value = i + 1;
      const total = yr * 12 + value;
      return {
        value,
        label: new Date(2000, i).toLocaleDateString('en-US', { month: 'short' }),
        inRange: total >= minTotal && total <= maxTotal,
      };
    });
  });

  toggleOverlay(): void {
    this.overlayYear.set(this.selectedYear());
    this.overlayOpen.update(v => !v);
  }

  prevMonth(): void {
    let m = this.selectedMonth() - 1;
    let y = this.selectedYear();
    if (m < 1) { m = 12; y -= 1; }
    this.monthChange.emit({ month: m, year: y });
  }

  nextMonth(): void {
    let m = this.selectedMonth() + 1;
    let y = this.selectedYear();
    if (m > 12) { m = 1; y += 1; }
    this.monthChange.emit({ month: m, year: y });
  }

  prevYear(): void { this.overlayYear.update(y => y - 1); }
  nextYear(): void { this.overlayYear.update(y => y + 1); }

  selectMonth(month: number): void {
    this.monthChange.emit({ month, year: this.overlayYear() });
    this.overlayOpen.set(false);
  }
}
