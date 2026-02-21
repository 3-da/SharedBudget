import { Injectable, inject, signal, computed, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Household, HouseholdInvitation, DashboardOverview, HouseholdRole } from '../../../shared/models';
import { HouseholdService } from '../services/household.service';
import { InvitationService } from '../services/invitation.service';
import { DashboardService } from '../../dashboard/services/dashboard.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractHttpError } from '../../../shared/utils/extract-error';

@Injectable({ providedIn: 'root' })
export class HouseholdStore {
  private readonly householdService = inject(HouseholdService);
  private readonly invitationService = inject(InvitationService);
  private readonly dashboardService = inject(DashboardService);
  private readonly snackBar = inject(MatSnackBar);
  // Use Injector for lazy resolution to break: HouseholdStore → AuthService → StoreResetService → HouseholdStore
  private readonly injector = inject(Injector);

  readonly household = signal<Household | null>(null);
  readonly overview = signal<DashboardOverview | null>(null);
  readonly invitations = signal<HouseholdInvitation[]>([]);
  readonly loading = signal(false);
  readonly overviewLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly viewMode = signal<'monthly' | 'yearly'>('monthly');
  readonly selectedMonth = signal(new Date().getMonth() + 1);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly hasHousehold = computed(() => !!this.household());
  readonly members = computed(() => this.household()?.members ?? []);
  readonly isOwner = computed(() => {
    const user = this.injector.get(AuthService).currentUser();
    if (!user) return false;
    return this.members().some(m => m.userId === user.id && m.role === HouseholdRole.OWNER);
  });
  readonly currentUserId = computed(() => this.injector.get(AuthService).currentUser()?.id ?? '');

  readonly monthLabel = computed(() => {
    const ov = this.overview();
    if (!ov) return '';
    return new Date(ov.year, ov.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  reset(): void {
    this.household.set(null);
    this.overview.set(null);
    this.invitations.set([]);
    this.loading.set(false);
    this.overviewLoading.set(false);
    this.error.set(null);
    this.viewMode.set('monthly');
    this.selectedMonth.set(new Date().getMonth() + 1);
    this.selectedYear.set(new Date().getFullYear());
  }

  loadHousehold(): void {
    this.loading.set(true);
    this.householdService.getMine().subscribe({
      next: h => {
        this.household.set(h);
        this.loading.set(false);
        this.loadOverview();
      },
      error: () => { this.household.set(null); this.loading.set(false); },
    });
  }

  loadOverview(): void {
    if (!this.overview()) this.overviewLoading.set(true);
    this.dashboardService.getOverview(this.viewMode(), this.selectedMonth(), this.selectedYear()).subscribe({
      next: o => { this.overview.set(o); this.overviewLoading.set(false); },
      error: () => { this.overview.set(null); this.overviewLoading.set(false); },
    });
  }

  setViewMode(mode: 'monthly' | 'yearly'): void {
    this.viewMode.set(mode);
    this.loadOverview();
  }

  setMonth(month: number, year: number): void {
    this.selectedMonth.set(month);
    this.selectedYear.set(year);
    this.loadOverview();
  }

  markSettlementPaid(): void {
    this.dashboardService.markSettlementPaid().subscribe({
      next: () => this.loadOverview(),
      error: err => this.error.set(extractHttpError(err)),
    });
  }

  createHousehold(name: string): void {
    this.loading.set(true);
    this.householdService.create({ name }).subscribe({
      next: h => { this.household.set(h); this.loading.set(false); },
      error: err => { this.error.set(extractHttpError(err)); this.loading.set(false); },
    });
  }

  joinByCode(inviteCode: string): void {
    this.loading.set(true);
    this.householdService.joinByCode({ inviteCode }).subscribe({
      next: h => { this.household.set(h); this.loading.set(false); },
      error: err => { this.error.set(extractHttpError(err)); this.loading.set(false); },
    });
  }

  regenerateCode(): void {
    this.householdService.regenerateCode().subscribe({
      next: h => this.household.set(h),
      error: err => this.snackBar.open(extractHttpError(err, 'Failed to regenerate code')!, '', { duration: 4000 }),
    });
  }

  leave(): void {
    this.householdService.leave().subscribe({
      next: () => { this.household.set(null); this.overview.set(null); },
      error: err => this.snackBar.open(extractHttpError(err, 'Failed to leave household')!, '', { duration: 4000 }),
    });
  }

  removeMember(userId: string): void {
    this.householdService.removeMember(userId).subscribe({
      next: () => this.loadHousehold(),
      error: err => this.snackBar.open(extractHttpError(err, 'Failed to remove member')!, '', { duration: 4000 }),
    });
  }

  transferOwnership(targetUserId: string): void {
    this.householdService.transferOwnership({ targetUserId }).subscribe({
      next: h => this.household.set(h),
      error: err => this.snackBar.open(extractHttpError(err, 'Failed to transfer ownership')!, '', { duration: 4000 }),
    });
  }

  loadInvitations(): void {
    this.invitationService.getPending().subscribe({
      next: inv => this.invitations.set(inv),
      error: () => this.invitations.set([]),
    });
  }
}
