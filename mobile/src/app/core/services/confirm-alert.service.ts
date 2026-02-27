import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';

@Injectable({ providedIn: 'root' })
export class ConfirmAlertService {
  private readonly alertCtrl = inject(AlertController);

  async confirm(options: {
    header: string;
    message: string;
    confirmText?: string;
    confirmColor?: string;
  }): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: options.header,
      message: options.message,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: options.confirmText ?? 'Confirm',
          role: 'confirm',
          cssClass: options.confirmColor === 'danger' ? 'alert-button-danger' : '',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }
}
