import { Component, inject, signal } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiService } from '../../../core/api/api.service';
import { ProfileFormComponent } from '../components/profile-form.component';
import { ChangePasswordFormComponent } from '../components/change-password-form.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { UpdateProfileRequest, ChangePasswordRequest } from '../../../shared/models/user.model';
import { MessageResponse } from '../../../shared/models/auth.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MatExpansionModule, ProfileFormComponent, ChangePasswordFormComponent, PageHeaderComponent],
  template: `
    <app-page-header title="Settings" subtitle="Manage your account" />
    <div class="settings-container">
      <mat-accordion>
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title>Profile</mat-panel-title>
          </mat-expansion-panel-header>
          <app-profile-form
            [user]="authService.currentUser()"
            [loading]="loading()"
            (save)="onUpdateProfile($event)" />
        </mat-expansion-panel>
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Change Password</mat-panel-title>
          </mat-expansion-panel-header>
          <app-change-password-form
            [loading]="loading()"
            (save)="onChangePassword($event)" />
        </mat-expansion-panel>
      </mat-accordion>
    </div>
  `,
  styles: [`.settings-container { max-width: 600px; margin: 16px auto; }`],
})
export class SettingsComponent {
  readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  readonly loading = signal(false);

  onUpdateProfile(dto: UpdateProfileRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me', dto).subscribe({
      next: () => {
        this.authService.loadCurrentUser().subscribe();
        this.snackBar.open('Profile updated', '', { duration: 3000 });
        this.loading.set(false);
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Update failed', '', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  onChangePassword(dto: ChangePasswordRequest): void {
    this.loading.set(true);
    this.api.put<MessageResponse>('/users/me/password', dto).subscribe({
      next: () => {
        this.snackBar.open('Password changed', '', { duration: 3000 });
        this.loading.set(false);
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Change failed', '', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }
}
