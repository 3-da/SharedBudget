import { Component, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule],
  template: `
    <mat-form-field appearance="outline" class="full-width">
      <mat-label>{{ label() }}</mat-label>
      <input matInput [type]="showPassword() ? 'text' : 'password'" [formControl]="control()">
      <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
        <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
      <mat-error>
        @if (control().hasError('required')) { Password is required }
        @else if (control().hasError('minlength')) { Minimum 8 characters }
        @else if (control().hasError('maxlength')) { Maximum 72 characters }
      </mat-error>
    </mat-form-field>
  `,
  styles: [`.full-width { width: 100%; }`],
})
export class PasswordFieldComponent {
  label = input('Password');
  control = input.required<FormControl<string>>();
  showPassword = signal(false);
}
