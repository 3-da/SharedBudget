import { ChangeDetectionStrategy, Component, inject, input, output, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonItem, IonInput, IonButton } from '@ionic/angular/standalone';
import { User, UpdateProfileRequest } from '../../../../../shared/models/user.model';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonItem, IonInput, IonButton],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <ion-item>
        <ion-input label="First Name" labelPlacement="floating" formControlName="firstName" />
      </ion-item>
      <ion-item>
        <ion-input label="Last Name" labelPlacement="floating" formControlName="lastName" />
      </ion-item>
      <ion-item>
        <ion-input label="Email" labelPlacement="floating" [value]="user()?.email ?? ''" [disabled]="true" />
      </ion-item>
      <ion-button expand="block" type="submit" [disabled]="loading() || form.invalid" class="ion-margin-top">
        Update Profile
      </ion-button>
    </form>
  `,
})
export class ProfileFormComponent {
  readonly user = input<User | null>(null);
  readonly loading = input(false);
  readonly save = output<UpdateProfileRequest>();
  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (u) this.form.patchValue({ firstName: u.firstName, lastName: u.lastName });
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.save.emit(this.form.getRawValue());
  }
}
