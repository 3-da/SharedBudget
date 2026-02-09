import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Reject Approval</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Reason</mat-label>
        <textarea matInput [formControl]="messageControl" rows="3" placeholder="Why are you rejecting?"></textarea>
        <mat-error>Reason is required</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="warn" [disabled]="messageControl.invalid" (click)="dialogRef.close(messageControl.value)">
        Reject
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.full-width { width: 100%; }`],
})
export class RejectDialogComponent {
  readonly dialogRef = inject(MatDialogRef<RejectDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly messageControl = this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]);
}
