import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Invite Member</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Email Address</mat-label>
        <input matInput [formControl]="emailControl" type="email" placeholder="member@example.com">
        <mat-error>Valid email is required</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button [disabled]="emailControl.invalid" (click)="dialogRef.close(emailControl.value)">
        Send Invite
      </button>
    </mat-dialog-actions>
  `,
  styles: [`.full-width { width: 100%; }`],
})
export class InviteDialogComponent {
  readonly dialogRef = inject(MatDialogRef<InviteDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly emailControl = this.fb.nonNullable.control('', [Validators.required, Validators.email]);
}
