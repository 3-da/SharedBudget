import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ExpenseFormComponent } from '../../personal-expenses/components/expense-form.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CreateExpenseRequest } from '../../../shared/models/expense.model';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-shared-expense-form-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, ExpenseFormComponent, LoadingSpinnerComponent],
  template: `
    <div class="form-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ isEdit() ? 'Propose Update' : 'Propose New' }} Shared Expense</mat-card-title>
          <button mat-icon-button class="close-btn" (click)="router.navigate(['/expenses/shared'])" aria-label="Close form">
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          @if (store.loading()) {
            <app-loading-spinner />
          } @else {
            <app-expense-form
              [expense]="store.selectedExpense()"
              [loading]="store.loading()"
              [showPaidBy]="false"
              (save)="onSave($event)" />
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .form-container { max-width: 600px; margin: 16px auto; }
    mat-card-header { position: relative; }
    .close-btn { position: absolute; top: 8px; right: 8px; }
  `],
})
export class SharedExpenseFormPageComponent {
  readonly store = inject(SharedExpenseStore);
  readonly router = inject(Router);

  readonly id = input<string>('');
  readonly isEdit = computed(() => !!this.id());

  constructor() {
    effect(() => {
      const expenseId = this.id();
      if (expenseId) this.store.loadExpense(expenseId);
      else this.store.selectedExpense.set(null);
    });
  }

  onSave(dto: CreateExpenseRequest): void {
    const onSuccess = () => this.router.navigate(['/expenses/shared']);
    const expenseId = this.id();
    if (this.isEdit()) this.store.proposeUpdate(expenseId, dto, undefined, undefined, onSuccess);
    else this.store.proposeCreate(dto, undefined, undefined, onSuccess);
  }
}
