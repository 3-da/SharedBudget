import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApprovalCardComponent } from './approval-card.component';
import { Approval } from '../../../shared/models/approval.model';

const pendingApproval: Approval = {
  id: 'a-1', expenseId: 'e-1', action: 'CREATE' as any, status: 'PENDING' as any,
  requestedBy: { id: 'u-1', firstName: 'Alex', lastName: 'Smith' },
  reviewedBy: null, message: null,
  proposedData: { name: 'Groceries', amount: 200 },
  createdAt: new Date().toISOString(), reviewedAt: null,
};

const acceptedApproval: Approval = {
  ...pendingApproval, id: 'a-2', status: 'ACCEPTED' as any,
  reviewedBy: { id: 'u-2', firstName: 'Sam', lastName: 'Jones' },
  reviewedAt: new Date().toISOString(),
};

@Component({
  standalone: true,
  imports: [ApprovalCardComponent],
  template: `<app-approval-card [approval]="approval()" (accept)="onAccept($event)" (reject)="onReject($event)" />`,
})
class TestHostComponent {
  approval = signal<Approval>(pendingApproval);
  accepted = '';
  rejected = '';
  onAccept(id: string) { this.accepted = id; }
  onReject(id: string) { this.rejected = id; }
}

describe('ApprovalCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show accept/reject buttons for PENDING approval', () => {
    const buttons = fixture.nativeElement.querySelectorAll('mat-card-actions button');
    expect(buttons.length).toBe(2);
  });

  it('should not show action buttons for non-PENDING approval', () => {
    host.approval.set(acceptedApproval);
    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelector('mat-card-actions');
    expect(actions).toBeNull();
  });

  it('should display proposed data', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Groceries');
    expect(text).toContain('200');
  });

  it('should display requester name', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alex');
    expect(text).toContain('Smith');
  });

  it('should emit accept with approval id', () => {
    const buttons = fixture.nativeElement.querySelectorAll('mat-card-actions button');
    buttons[0].click();
    expect(host.accepted).toBe('a-1');
  });

  it('should emit reject with approval id', () => {
    const buttons = fixture.nativeElement.querySelectorAll('mat-card-actions button');
    buttons[1].click();
    expect(host.rejected).toBe('a-1');
  });
});
