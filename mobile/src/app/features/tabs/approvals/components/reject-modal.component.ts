import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonTextarea,
  IonNote,
  ModalController,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-reject-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButtons, IonButton, IonItem, IonTextarea, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Reject Approval</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form [formGroup]="form">
        <ion-item>
          <ion-textarea
            label="Reason"
            labelPlacement="floating"
            formControlName="message"
            rows="4"
            placeholder="Why are you rejecting this?" />
        </ion-item>
        @if (form.controls.message.touched && form.controls.message.invalid) {
          <ion-note color="danger" class="ion-padding-start">
            Reason is required (min 3 characters)
          </ion-note>
        }
      </form>
      <ion-button
        expand="block"
        color="danger"
        [disabled]="form.invalid"
        (click)="submit()"
        class="ion-margin-top">
        Reject
      </ion-button>
    </ion-content>
  `,
})
export class RejectModalComponent {
  private readonly modalCtrl = inject(ModalController);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.minLength(3)]],
  });

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  submit(): void {
    if (this.form.valid) {
      this.modalCtrl.dismiss(this.form.getRawValue().message, 'confirm');
    }
  }
}
