import { Component, signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ProfileFormComponent } from './profile-form.component';
import { User } from '../../../shared/models/user.model';

const mockUser: User = {
  id: 'u-1', email: 'a@b.com', firstName: 'Alex', lastName: 'Smith',
  emailVerified: true, createdAt: '2025-01-01',
};

@Component({
  standalone: true,
  imports: [ProfileFormComponent],
  template: `<app-profile-form [user]="user()" (save)="onSave($event)" />`,
})
class TestHostComponent {
  user = signal<User | null>(null);
  saved: any = null;
  onSave(dto: any) { this.saved = dto; }
}

describe('ProfileFormComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideAnimationsAsync()],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should pre-fill from user input', () => {
    host.user.set(mockUser);
    fixture.detectChanges();
    const component = fixture.debugElement.children[0].componentInstance as ProfileFormComponent;
    expect(component.form.value.firstName).toBe('Alex');
    expect(component.form.value.lastName).toBe('Smith');
  });

  it('should emit save with updated values', () => {
    host.user.set(mockUser);
    fixture.detectChanges();
    const component = fixture.debugElement.children[0].componentInstance as ProfileFormComponent;
    component.form.patchValue({ firstName: 'Updated', lastName: 'Name' });
    component.onSubmit();
    expect(host.saved).toEqual({ firstName: 'Updated', lastName: 'Name' });
  });

  it('should not emit save when form is invalid', () => {
    const component = fixture.debugElement.children[0].componentInstance as ProfileFormComponent;
    component.form.patchValue({ firstName: '', lastName: '' });
    component.onSubmit();
    expect(host.saved).toBeNull();
  });
});
