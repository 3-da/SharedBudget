import { Component, input, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import {
  IonItem,
  IonInput,
  IonIcon,
  IonButton,
  IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonIcon, IonButton, IonNote],
  template: `
    <ion-item>
      <ion-input
        [label]="label()"
        labelPlacement="floating"
        [type]="showPassword() ? 'text' : 'password'"
        [formControl]="control()"
        [clearOnEdit]="false">
      </ion-input>
      <ion-button fill="clear" slot="end" (click)="showPassword.set(!showPassword())" type="button">
        <ion-icon slot="icon-only" [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'" />
      </ion-button>
    </ion-item>
    @if (control().touched && control().invalid) {
      <ion-note color="danger" class="ion-padding-start">
        @if (control().hasError('required')) { Password is required }
        @else if (control().hasError('minlength')) { Minimum 8 characters }
        @else if (control().hasError('maxlength')) { Maximum 72 characters }
      </ion-note>
    }
  `,
})
export class PasswordFieldComponent {
  label = input('Password');
  control = input.required<FormControl<string>>();
  showPassword = signal(false);

  constructor() {
    addIcons({ eyeOutline, eyeOffOutline });
  }
}
