import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatDialogRef } from '@angular/material/dialog';
import { RejectDialogComponent } from './reject-dialog.component';

describe('RejectDialogComponent', () => {
  let component: RejectDialogComponent;
  let fixture: ComponentFixture<RejectDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideAnimationsAsync(),
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    fixture = TestBed.createComponent(RejectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be invalid when message is empty', () => {
    expect(component.messageControl.invalid).toBe(true);
  });

  it('should be invalid when message is too short', () => {
    component.messageControl.setValue('ab');
    expect(component.messageControl.hasError('minLength') || component.messageControl.invalid).toBe(true);
  });

  it('should be valid with sufficient message', () => {
    component.messageControl.setValue('Too expensive for now');
    expect(component.messageControl.valid).toBe(true);
  });

  it('cancel button closes dialog without value', () => {
    const cancelBtn = fixture.nativeElement.querySelectorAll('button')[0];
    cancelBtn.click();
    expect(dialogRef.close).toHaveBeenCalledWith();
  });
});
