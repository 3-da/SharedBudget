import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedExpenseStore } from '../stores/shared-expense.store';
import { ExpenseFormComponent } from '../../personal-expenses/components/expense-form.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { CreateExpenseRequest } from '../../../shared/models/expense.model';

@Component({
  selector: 'app-shared-expense-form-page',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatIconModule, ExpenseFormComponent, LoadingSpinnerComponent],
  template: `
    <div class="form-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ isEdit ? 'Propose Update' : 'Propose New' }} Shared Expense</mat-card-title>
          <button mat-icon-button class="close-btn" (click)="router.navigate(['/expenses/shared'])">
            <mat-icon>close</mat-icon>
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
export class SharedExpenseFormPageComponent implements OnInit {
  readonly store = inject(SharedExpenseStore);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  isEdit = false;
  private expenseId = '';

  ngOnInit(): void {
    this.expenseId = this.route.snapshot.params['id'] ?? '';
    this.isEdit = !!this.expenseId;
    if (this.isEdit) this.store.loadExpense(this.expenseId);
    else this.store.selectedExpense.set(null);
  }

  onSave(dto: CreateExpenseRequest): void {
    const onSuccess = () => this.router.navigate(['/expenses/shared']);
    if (this.isEdit) this.store.proposeUpdate(this.expenseId, dto, undefined, undefined, onSuccess);
    else this.store.proposeCreate(dto, undefined, undefined, onSuccess);
  }
}
