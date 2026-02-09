import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    snackBarSpy = { open: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: MatSnackBar, useValue: snackBarSpy },
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('should extract message from HttpErrorResponse', () => {
    const error = new HttpErrorResponse({
      error: { message: 'Not found' },
      status: 404,
    });
    handler.handleError(error);
    expect(snackBarSpy.open).toHaveBeenCalledWith('Not found', 'Close', expect.any(Object));
  });

  it('should handle array messages (validation errors)', () => {
    const error = new HttpErrorResponse({
      error: { message: ['field1 is required', 'field2 is invalid'] },
      status: 400,
    });
    handler.handleError(error);
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'field1 is required, field2 is invalid',
      'Close',
      expect.any(Object),
    );
  });

  it('should show status when no error message', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
    handler.handleError(error);
    expect(snackBarSpy.open).toHaveBeenCalledWith('Server error: 500', 'Close', expect.any(Object));
  });

  it('should handle generic Error', () => {
    handler.handleError(new Error('Something broke'));
    expect(snackBarSpy.open).toHaveBeenCalledWith('Something broke', 'Close', expect.any(Object));
  });

  it('should handle unknown error type', () => {
    handler.handleError('random string');
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'An unexpected error occurred',
      'Close',
      expect.any(Object),
    );
  });

  it('should show snackbar with error-snackbar panelClass', () => {
    handler.handleError(new Error('test'));
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'test',
      'Close',
      expect.objectContaining({ duration: 5000, panelClass: 'error-snackbar' }),
    );
  });
});
