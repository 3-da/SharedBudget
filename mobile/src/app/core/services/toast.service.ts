import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastCtrl = inject(ToastController);

  async showSuccess(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'success',
      position: 'bottom',
    });
    await toast.present();
  }

  async showError(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }

  async showInfo(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'medium',
      position: 'bottom',
    });
    await toast.present();
  }
}
