import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonItem, IonInput, IonButton } from '@ionic/angular/standalone';
import { HouseholdStore } from '../../../household/stores/household.store';

@Component({
  selector: 'app-join-by-code-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonButton],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <ion-item>
        <ion-input
          label="Invite Code"
          labelPlacement="floating"
          formControlName="inviteCode"
          placeholder="8-character code"
          maxlength="8">
        </ion-input>
      </ion-item>
      <ion-button expand="block" type="submit" [disabled]="form.invalid || store.loading()" class="ion-margin-top">
        Join Household
      </ion-button>
    </form>
  `,
})
export class JoinByCodeFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(HouseholdStore);
  form = this.fb.nonNullable.group({
    inviteCode: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(8)]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.store.joinByCode(this.form.getRawValue().inviteCode);
  }
}
