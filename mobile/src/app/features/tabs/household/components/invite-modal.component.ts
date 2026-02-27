import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonItem, IonInput, ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-invite-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonInput,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Invite Member</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-item>
          <ion-input
            label="Email Address"
            labelPlacement="floating"
            formControlName="email"
            type="email"
            placeholder="member@example.com">
          </ion-input>
        </ion-item>
        <ion-button expand="block" type="submit" [disabled]="form.invalid" class="ion-margin-top">
          Send Invite
        </ion-button>
      </form>
    </ion-content>
  `,
})
export class InviteModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly fb = inject(FormBuilder);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  dismiss(): void {
    this.modalCtrl.dismiss(null);
  }

  submit(): void {
    if (this.form.invalid) return;
    this.modalCtrl.dismiss(this.form.getRawValue().email);
  }
}
