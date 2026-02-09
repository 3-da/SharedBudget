import { ErrorHandler, Injectable, inject, NgZone } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly snackBar = inject(MatSnackBar);
  private readonly zone = inject(NgZone);

  handleError(error: unknown): void {
    console.error('Unhandled error:', error);

    const message = this.extractMessage(error);
    this.zone.run(() => {
      this.snackBar.open(message, 'Close', {
        duration: 5000,
        panelClass: 'error-snackbar',
      });
    });
  }

  private extractMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.error?.message) {
        return Array.isArray(error.error.message)
          ? error.error.message.join(', ')
          : error.error.message;
      }
      return `Server error: ${error.status}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }
}
