import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonItem, IonInput, IonButton } from '@ionic/angular/standalone';
import { HouseholdStore } from '../../../household/stores/household.store';

@Component({
  selector: 'app-create-household-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonButton],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <ion-item>
        <ion-input
          label="Household Name"
          labelPlacement="floating"
          formControlName="name"
          placeholder="e.g., The Smiths"
          maxlength="50">
        </ion-input>
      </ion-item>
      <ion-button expand="block" type="submit" [disabled]="form.invalid || store.loading()" class="ion-margin-top">
        Create Household
      </ion-button>
    </form>
  `,
})
export class CreateHouseholdFormComponent {
  private readonly fb = inject(FormBuilder);
  readonly store = inject(HouseholdStore);
  form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(50)]] });

  onSubmit(): void {
    if (this.form.invalid) return;
    this.store.createHousehold(this.form.getRawValue().name);
  }
}
