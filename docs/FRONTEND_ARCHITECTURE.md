# SharedBudget Frontend Architecture

> A comprehensive technical reference for every architectural and design decision
> in the SharedBudget Angular frontend. Written for interview preparation and
> team onboarding — every section answers **why**, not just **what**.

**Stack**: Angular 21.1.x | Angular Material 21.1.x (M3) | TypeScript 5.9 | Vitest | Playwright
**Pattern**: Feature-Sliced Design with Container/Presentational components and custom signal stores

---

## Table of Contents

1. [Tech Stack and Bootstrap](#1-tech-stack-and-bootstrap)
2. [Architecture Pattern — Feature-Sliced Design](#2-architecture-pattern--feature-sliced-design)
3. [Container/Presentational Pattern (Smart/Dumb)](#3-containerpresentational-pattern-smartdumb)
4. [Signal Store Pattern (Custom State Management)](#4-signal-store-pattern-custom-state-management)
5. [Reactive Programming — Observables vs Signals](#5-reactive-programming--observables-vs-signals)
6. [Auth Architecture](#6-auth-architecture)
7. [Routing and Lazy Loading](#7-routing-and-lazy-loading)
8. [API Layer Design](#8-api-layer-design)
9. [State Management Deep Dive](#9-state-management-deep-dive)
10. [UI/UX Patterns](#10-uiux-patterns)
11. [Change Detection Strategy](#11-change-detection-strategy)
12. [Error Handling](#12-error-handling)
13. [Testing Strategy](#13-testing-strategy)
14. [Design Principles](#14-design-principles)
15. [Appendix](#15-appendix)

---

## 1. Tech Stack and Bootstrap

### 1.1 Technology Choices

| Technology | Version | Purpose | Why This Choice |
|---|---|---|---|
| **Angular** | 21.1.x | UI framework | Latest stable. Standalone components, signals, zoneless change detection. Strong typing, DI, and opinionated structure reduce decision fatigue. |
| **Angular Material** | 21.1.x | Component library (M3) | Material 3 design system with built-in accessibility (ARIA), theming via CSS custom properties, and dark mode support. No need to build a design system from scratch. |
| **date-fns** | 4.x | Date manipulation | Tree-shakable (import only the functions you use), immutable by design, ~6KB vs moment.js ~72KB. Luxon is good but heavier (~23KB) and its OOP API is unnecessary when you just need formatting and arithmetic. |
| **chart.js** | 4.5.x | Data visualization | Canvas-based, lightweight (~60KB), simple API for bar/line charts. D3 (~240KB) is overkill for our 3 chart types. Recharts/Nivo are React-specific. |
| **Vitest** | 4.x | Unit testing | ESM-native (no CJS transform overhead), 2-5x faster than Jest for TypeScript projects. Compatible with Angular's TestBed. Karma is officially deprecated by Angular team. |
| **Playwright** | - | E2E testing | Cross-browser (Chromium, Firefox, WebKit), reliable auto-waiting selectors, parallel execution, built-in trace viewer. Cypress lacks multi-browser and true parallelism. |
| **TypeScript** | 5.9 | Language | Strict mode catches null/undefined bugs at compile time. Latest ECMAScript features (decorators, using declarations). |

### 1.2 Bootstrap Configuration

The entire application is configured in a single file — `app.config.ts`. Every line has a specific purpose:

```typescript
// frontend/src/app/app.config.ts

import {
  ApplicationConfig, ErrorHandler,
  provideZonelessChangeDetection, provideAppInitializer, inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { GlobalErrorHandler } from './core/error/error-handler.service';
import { AuthService } from './core/auth/auth.service';
import { TokenService } from './core/auth/token.service';

function initializeAuth(): Observable<unknown> {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);

  if (tokenService.getRefreshToken()) {
    return authService.refresh().pipe(
      switchMap(() => authService.loadCurrentUser()),
      catchError(() => of(null)),
    );
  }
  return of(null);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(initializeAuth),
  ],
};
```

#### Line-by-line explanation

| Provider | What It Does | Why |
|---|---|---|
| `provideZonelessChangeDetection()` | Removes Zone.js from the application entirely. Angular no longer monkey-patches async APIs (`setTimeout`, `Promise`, `XHR`). Instead, change detection is driven exclusively by signals. | **Performance**: Zone.js is ~13KB gzipped and adds overhead to every async operation. **Simpler mental model**: you never wonder "why did CD trigger?" — signals make it explicit. Stable since Angular 19. |
| `provideRouter(routes, withComponentInputBinding())` | Registers the router and enables automatic binding of route params to component `input()` properties. | `withComponentInputBinding()` means a route with `path: ':id'` automatically populates a component's `readonly id = input.required<string>()` — no need to inject `ActivatedRoute` and subscribe to `paramMap`. Eliminates subscription boilerplate in every page component. |
| `provideHttpClient(withInterceptors([authInterceptor]))` | Configures HttpClient with a functional interceptor for auth token injection. | Functional interceptors (introduced Angular 15) are tree-shakable and simpler than class-based `HTTP_INTERCEPTORS` multi-providers. No need for `@Injectable()` classes, no token injection order confusion. |
| `provideAnimationsAsync()` | Loads the Angular animation module asynchronously. | Keeps the animation engine (~16KB) out of the initial bundle. It's loaded on demand when the first animation triggers. Since we use Material components with animations (dialogs, snackbars), we need it but don't want it blocking first paint. |
| `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` | Replaces Angular's default `ErrorHandler` with our custom implementation. | Acts as a global error boundary — catches ALL unhandled exceptions thrown anywhere in the app (components, services, event handlers) and displays a user-friendly snackbar instead of silently logging to console. |
| `provideAppInitializer(initializeAuth)` | Runs `initializeAuth()` before the app renders any components. Angular waits for the returned Observable to complete. | On page refresh, the in-memory access token is lost. This initializer checks for a stored refresh token, silently refreshes the session, and loads the user profile — all before the user sees anything. Without it, authenticated users would see a brief flash of the login page on every refresh. |

#### The `initializeAuth` function

This is a **higher-order observable chain** (covered in detail in [Section 5.3](#53-higher-order-observables)):

1. Check if a refresh token exists in localStorage
2. If yes: call `authService.refresh()` (POST to `/api/v1/auth/refresh`)
3. On success: `switchMap` into `authService.loadCurrentUser()` (GET `/api/v1/auth/me`)
4. On failure: `catchError` returns `of(null)` — app still boots, but user lands on the login page
5. If no refresh token: return `of(null)` immediately — no network request, instant boot

The `switchMap` operator is used here because the operations are sequential and dependent: you cannot load the current user without first obtaining a valid access token from the refresh call.

### 1.3 Root Component

```typescript
// frontend/src/app/app.ts

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class App {}
```

The root component is deliberately minimal — just a `<router-outlet>`. All layout (toolbar, sidenav, content area) is handled by `ShellComponent`, which is loaded via routing. This matters because:

- The shell is **lazy-loadable** — it's only downloaded after the auth guard confirms the user is authenticated
- The root stays tiny (~0 KB logic), so the initial bootstrap is as fast as possible
- Auth pages (login, register) have their own layout — they don't need the shell's toolbar/sidenav

---

## 2. Architecture Pattern — Feature-Sliced Design

### 2.1 Three-Layer Structure

```
frontend/src/app/
├── core/           Singleton services, app-wide infrastructure (loaded once)
├── shared/         Reusable components, pipes, directives, models (imported by features)
└── features/       9 lazy-loaded feature modules (business domains)
```

This is **Feature-Sliced Design** (FSD), an architectural methodology that originated in the Vue/React ecosystem and maps naturally to Angular's module-free standalone component model. The key principle is a **one-directional dependency graph**:

```
features/ ──imports──> shared/ ──imports──> (nothing from features)
features/ ──imports──> core/   ──imports──> (nothing from features or core)
shared/   ──imports──> (nothing from features or core)
core/     ──imports──> (nothing from features)
```

**Rules**:
- `core/` never imports from `core/` (each core service is independent)
- `shared/` never imports from `features/` (shared is feature-agnostic)
- `features/` never imports from other `features/` (features are isolated domains)
- Dependencies flow **inward** only: features → shared → core

#### Why not alternatives?

| Approach | Tradeoff |
|---|---|
| **Traditional NgModule-per-feature** | Heavier (NgModules add boilerplate), declarations/exports arrays to maintain, harder tree-shaking. Angular team now recommends standalone components. |
| **Nx library approach** (`libs/feature-*`, `libs/shared-*`) | Excellent for monorepos with multiple apps, but overkill for a single-app repo. Adds Nx tooling overhead, workspace configuration, and library boundary enforcement rules. |
| **Flat structure** (all components in one directory) | Works for tiny apps (~10 components). Becomes unnavigable beyond 30 components. No logical grouping. |
| **Domain-driven folders** (no core/shared separation) | Features end up duplicating UI components. No clear place for app-wide singletons. Cross-cutting concerns bleed into features. |

### 2.2 Core Layer Detail

The `core/` directory contains services and components that are **instantiated once** and used across the entire application. Nothing in core is feature-specific.

| Directory | Contents | Responsibility |
|---|---|---|
| `core/api/` | `ApiService` | Centralized HTTP wrapper. Single point for the API base URL. All feature services delegate to this. |
| `core/auth/` | `AuthService`, `TokenService`, `auth.interceptor.ts`, `auth.guard.ts` | Full auth lifecycle: login, register, refresh, logout, token storage, request interception, route protection. |
| `core/error/` | `GlobalErrorHandler` | Unhandled error catch-all. Implements Angular's `ErrorHandler` interface. Shows error snackbars. |
| `core/layout/` | `ShellComponent`, `ToolbarComponent`, `SidenavComponent` | App chrome — the toolbar, sidenav navigation, and content area. Responsive layout with desktop/mobile detection. |
| `core/theme/` | `ThemeService` | Light/dark/system mode toggle with localStorage persistence. Uses `effect()` to apply CSS class changes. |

**Why each belongs in core**: They are singletons (one instance for the entire app), have no feature-specific logic, and are needed before any feature loads. The `ApiService` doesn't know about expenses or salaries — it just constructs URLs and dispatches HTTP methods.

### 2.3 Shared Layer Detail

The `shared/` directory contains **reusable building blocks** with zero business logic. Everything here is presentational or utility-focused.

#### Components (7)

| Component | Purpose | Used By |
|---|---|---|
| `LoadingSpinnerComponent` | Centered Material spinner shown while store `loading()` signal is `true` | Every feature's list page |
| `EmptyStateComponent` | Icon + title + description + optional action button when a list is empty | Expense lists, approvals, savings |
| `CurrencyDisplayComponent` | Formatted EUR display with positive/negative color coding | Dashboard cards, expense details |
| `ConfirmDialogComponent` | Reusable Material dialog for destructive actions (delete, leave household) | Expense deletion, household leave/remove |
| `PageHeaderComponent` | Consistent page title + subtitle + action slot area | Every page component |
| `BaseChartComponent` | chart.js wrapper with theme-aware colors (auto-switches on dark mode) | Household charts, salary chart, savings chart |
| `MonthPickerComponent` | Month/year navigation with prev/next arrows and current month display | Expense lists, salary overview, timeline |

All shared components are **presentational**: they receive data via `input()`, emit events via `output()`, and inject no services or stores. This makes them trivially testable and reusable across any feature.

#### Pipes (3)

| Pipe | Purpose | Why Pure |
|---|---|---|
| `CurrencyEurPipe` | Formats number as EUR currency string (e.g., `1234.5` → `1.234,50 €`) | Pure pipes are memoized — Angular only recalculates when the input value changes. With OnPush components, this means zero recalculation on unrelated change detection cycles. |
| `MonthlyEquivalentPipe` | Converts yearly amounts to monthly equivalent | Same memoization benefit |
| `RelativeTimePipe` | Formats dates as relative time (e.g., "2 hours ago") using date-fns | Same memoization benefit |

#### Directives (2)

| Directive | Purpose |
|---|---|
| `AutoFocusDirective` | Automatically focuses an input element on mount. Used in forms (login, create expense). |
| `PositiveNumberDirective` | Prevents non-numeric and negative input at the keypress level. Applied to amount fields. |

#### Validators (1)

| Validator | Purpose |
|---|---|
| `PasswordMatchValidator` | Cross-field validator that checks `password` and `confirmPassword` fields match. Used in registration and password change forms. |

#### Models (barrel export via `index.ts`)

All TypeScript interfaces for API request/response shapes:

```
auth.model.ts, user.model.ts, household.model.ts, expense.model.ts,
expense-payment.model.ts, approval.model.ts, salary.model.ts,
saving.model.ts, dashboard.model.ts, recurring-override.model.ts, enums.ts
```

**Design decision**: Models are **interfaces only** — no classes. Interfaces are erased at compile time (zero runtime cost), and since we only need type checking for API data shapes (not methods or constructor logic), classes would add unnecessary weight. The `enums.ts` file uses TypeScript `enum` for values that need runtime representation (used in template comparisons and switch statements).

#### Utils

| File | Purpose |
|---|---|
| `chart-colors.ts` | Shared color palette for chart.js instances. Ensures visual consistency across all charts. |

### 2.4 Feature Layer Detail

Each feature is a **self-contained business domain** with its own pages, components, services, and state. Features are lazy-loaded — their code is only downloaded when the user navigates to that feature.

| Feature | Pages | Components | Services | Store | Route Prefix |
|---|---|---|---|---|---|
| `auth` | 5 (login, register, verify-code, forgot-password, reset-password) | 2 (code-input, password-field) | 0 (uses AuthService from core) | 0 | `/auth` |
| `household` | 3 (detail, member-detail, pending-invitations) | 10 (create form, join form, invite dialog, member list, member finance card, financial summary, settlement summary, income-expense chart, savings chart, household management) | 2 (household, invitation) | 1 | `/household` |
| `personal-expenses` | 3 (list, form-page, recurring-timeline) | 3 (expense-card, expense-form, recurring-override-dialog) | 3 (personal-expense, expense-payment, recurring-override) | 1 | `/expenses/personal` |
| `shared-expenses` | 3 (list, form-page, recurring-timeline) | 1 (shared-expense-card) | 1 | 1 | `/expenses/shared` |
| `approvals` | 1 (approval-list) | 2 (approval-card, reject-dialog) | 1 | 1 | `/approvals` |
| `dashboard` | 1 (dashboard) | 4 (income-summary, expense-summary, savings-card, settlement-card) | 1 | 1 | `/dashboard` |
| `salary` | 1 (salary-overview) | 3 (salary-form, salary-summary-card, salary-chart) | 1 | 1 | `/salary` |
| `savings` | 1 (savings-overview) | 2 (savings-history-chart, withdraw-dialog) | 1 | 1 | `/savings` |
| `settings` | 1 (settings) | 2 (profile-form, change-password-form) | 0 (uses AuthService + UserService from core) | 0 | `/settings` |

**Totals**: 9 features | 19 pages | 28 feature components | 7 shared components | 7 signal stores | 10+ API services

### 2.5 Internal Feature Structure Convention

Every feature follows the **exact same** folder layout:

```
feature/
  components/           # Presentational (dumb) components — pure UI, no service injection
  pages/                # Container (smart) components — routed, inject stores
  services/             # Thin HTTP service wrappers — call ApiService, return Observable
  stores/               # Signal-based state management — single source of truth
  feature.routes.ts     # Route definitions for this feature
```

This convention is critical for developer productivity:
- **New developers** know immediately where to find or add code without asking
- **Code reviews** can verify structural compliance at a glance
- **Consistency over creativity** — when every feature looks the same, cognitive load drops to near zero when switching between features

The only exceptions are `auth` and `settings`, which have no stores or feature-specific services because they use `AuthService` from core directly. This is acceptable because their state (current user, auth tokens) is inherently app-wide, not feature-scoped.

---

## 3. Container/Presentational Pattern (Smart/Dumb)

### 3.1 Concept Explanation

This is one of the most important patterns in the codebase. Every component falls into one of two categories:

| | Pages (Containers / Smart) | Components (Presentational / Dumb) |
|---|---|---|
| **Knows about** | Stores, Router, Dialogs | Only its own inputs and outputs |
| **Gets data from** | Injecting stores, reading signals | `input()` properties passed by parent |
| **Sends data via** | Calling store methods directly | `output()` events caught by parent |
| **Routing** | Routed via `loadComponent` in route config | Never routed — always a child of a page |
| **Change detection** | OnPush (reads store signals) | OnPush (re-renders only when inputs change) |
| **Testability** | Requires mocking stores/router | Trivial — set inputs, assert outputs |
| **Reusability** | Low (tied to a specific route and store) | High (can be used in any context with matching inputs) |

**Why this separation matters**:

1. **Testability**: Presentational components are trivially testable — set inputs, check rendered output, trigger events, verify emitted values. No HTTP mocking, no store mocking, no router setup.
2. **Reusability**: `ExpenseCardComponent` could theoretically render personal or shared expenses — it doesn't care, it just receives an `Expense` object.
3. **Single responsibility**: Pages orchestrate (load data, handle navigation, show dialogs). Components render (display data, emit user interactions).
4. **Change detection efficiency**: Presentational components with OnPush only re-render when their input references change. If a store signal updates an unrelated piece of state, the presentational component is untouched.

### 3.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIDIRECTIONAL DATA FLOW                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐    reads signals    ┌────────────────┐       │
│  │   Store   │ ──────────────────> │  Page (Smart)  │       │
│  │  signals  │                     │  Component     │       │
│  └───────────┘                     └───────┬────────┘       │
│       ▲                                    │                │
│       │                              passes via             │
│  calls store                          input()               │
│    method                                  │                │
│       │                                    ▼                │
│       │                            ┌────────────────┐       │
│       │                            │  Presentational │       │
│       │                            │  Component     │       │
│       │                            └───────┬────────┘       │
│       │                                    │                │
│       │                              emits via              │
│       └──── Page catches event ◄── output()                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Data flows **down** (store → page → component via inputs).
Events flow **up** (component → page → store via outputs).
There is **no two-way binding** to store state. Components never directly modify store signals.

### 3.3 Code Examples

#### Page (Container) Example — `PersonalExpenseListComponent`

```typescript
// frontend/src/app/features/personal-expenses/pages/personal-expense-list.component.ts

@Component({
  selector: 'app-personal-expense-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule, MatIconModule,
    ExpenseCardComponent,       // ◄ presentational child
    MonthPickerComponent,       // ◄ shared presentational
    PageHeaderComponent,        // ◄ shared presentational
    LoadingSpinnerComponent,    // ◄ shared presentational
    EmptyStateComponent,        // ◄ shared presentational
    CurrencyEurPipe,
  ],
  template: `
    <app-page-header title="My Expenses"
                     [subtitle]="'Total: ' + (store.totalMonthly() | currencyEur)">
      <div class="actions">
        <app-month-picker
          [selectedMonth]="month()"
          [selectedYear]="year()"
          (monthChange)="onMonthChange($event)" />
        <button mat-flat-button
                (click)="router.navigate(['/expenses/personal/new'])">
          <mat-icon>add</mat-icon> Add Expense
        </button>
      </div>
    </app-page-header>

    @if (store.loading()) {
      <app-loading-spinner />
    } @else if (store.expenses().length === 0) {
      <app-empty-state icon="receipt_long"
                       title="No Expenses"
                       description="Add your first personal expense to start tracking." />
    } @else {
      <div class="expense-grid">
        @for (e of store.expenses(); track e.id) {
          <app-expense-card
            [expense]="e"
            [paymentStatus]="store.paymentStatuses().get(e.id) ?? null"
            (edit)="onEdit($event)"
            (remove)="onDelete($event)"
            (markPaid)="onMarkPaid($event)"
            (undoPaid)="onUndoPaid($event)"
            (viewTimeline)="onTimeline($event)" />
        }
      </div>
    }
  `,
})
export class PersonalExpenseListComponent implements OnInit {
  // ── Injections (store, router, dialog) ──────────────────────────
  readonly store = inject(PersonalExpenseStore);    // ◄ Smart: knows about store
  readonly router = inject(Router);                 // ◄ Smart: knows about routing
  private readonly dialog = inject(MatDialog);      // ◄ Smart: orchestrates UI dialogs
  private readonly destroyRef = inject(DestroyRef);

  // ── Local UI state (not in store — page-scoped) ─────────────────
  readonly month = signal(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());

  ngOnInit(): void { this.load(); }

  onMonthChange(event: { month: number; year: number }): void {
    this.month.set(event.month);
    this.year.set(event.year);
    this.load();
  }

  onEdit(id: string): void {
    this.router.navigate(['/expenses/personal', id, 'edit']);
  }

  onDelete(id: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Expense',
        message: 'Delete this expense permanently?',
        confirmText: 'Delete', color: 'warn',
      } as ConfirmDialogData,
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(ok => {
      if (ok) this.store.deleteExpense(id, this.month(), this.year());
    });
  }

  onMarkPaid(id: string): void {
    this.store.markPaid(id, this.month(), this.year());
  }

  onUndoPaid(id: string): void {
    this.store.undoPaid(id, this.month(), this.year());
  }

  onTimeline(id: string): void {
    this.router.navigate(['/expenses/personal', id, 'timeline']);
  }

  private load(): void {
    this.store.loadExpenses(this.month(), this.year());
  }
}
```

**What makes this a page/container**:
- Injects `PersonalExpenseStore` — reads signals, calls action methods
- Injects `Router` — handles navigation on edit/timeline events
- Injects `MatDialog` — orchestrates the confirm dialog flow
- Has `OnInit` that triggers data loading
- Passes store data **down** to `ExpenseCardComponent` via `[expense]` and `[paymentStatus]` inputs
- Catches events **up** from child via `(edit)`, `(remove)`, `(markPaid)`, etc.
- Owns page-scoped UI state (`month`, `year`) that doesn't belong in the global store

#### Presentational Example — `ExpenseCardComponent`

```typescript
// frontend/src/app/features/personal-expenses/components/expense-card.component.ts

@Component({
  selector: 'app-expense-card',
  standalone: true,
  imports: [
    MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatTooltipModule, CurrencyEurPipe,
  ],
  template: `
    <mat-card [class.paid]="isPaid()">
      <mat-card-header>
        <mat-card-title>{{ expense().name }}</mat-card-title>
        <mat-card-subtitle>
          <mat-chip-set>
            <mat-chip>{{ expense().category }}</mat-chip>
            <mat-chip>{{ expense().frequency }}</mat-chip>
            @if (isPaid()) {
              <mat-chip class="paid-chip">Paid</mat-chip>
            }
          </mat-chip-set>
        </mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <span class="amount">{{ expense().amount | currencyEur }}</span>
      </mat-card-content>
      <mat-card-actions>
        @if (isPaid()) {
          <button mat-icon-button (click)="undoPaid.emit(expense().id)"
                  matTooltip="Mark as unpaid">
            <mat-icon>undo</mat-icon>
          </button>
        } @else {
          <button mat-icon-button (click)="markPaid.emit(expense().id)"
                  matTooltip="Mark as paid">
            <mat-icon>check_circle</mat-icon>
          </button>
        }
        @if (hasTimeline()) {
          <button mat-icon-button (click)="viewTimeline.emit(expense().id)"
                  matTooltip="Timeline">
            <mat-icon>timeline</mat-icon>
          </button>
        }
        <button mat-icon-button (click)="edit.emit(expense().id)">
          <mat-icon>edit</mat-icon>
        </button>
        <button mat-icon-button (click)="remove.emit(expense().id)">
          <mat-icon>delete</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
})
export class ExpenseCardComponent {
  // ── Inputs (data flows IN) ────────────────────────────────────
  readonly expense = input.required<Expense>();
  readonly paymentStatus = input<PaymentStatus | null>(null);

  // ── Outputs (events flow OUT) ─────────────────────────────────
  readonly edit = output<string>();
  readonly remove = output<string>();
  readonly markPaid = output<string>();
  readonly undoPaid = output<string>();
  readonly viewTimeline = output<string>();

  // ── Computed (derived from inputs, no external dependencies) ──
  readonly isPaid = computed(() => this.paymentStatus() === PaymentStatus.PAID);
  readonly hasTimeline = computed(() => {
    const e = this.expense();
    if (e.category === ExpenseCategory.RECURRING) return true;
    if (e.category === ExpenseCategory.ONE_TIME
        && e.yearlyPaymentStrategy === YearlyPaymentStrategy.INSTALLMENTS) return true;
    return false;
  });
}
```

**What makes this presentational**:
- **Zero injected services** — no store, no router, no HTTP, no dialog
- **Data in** via `input()` signals — `expense` and `paymentStatus`
- **Events out** via `output()` — `edit`, `remove`, `markPaid`, `undoPaid`, `viewTimeline`
- **Computed** signals derive display logic from inputs only — `isPaid` and `hasTimeline`
- **To test**: create component, set `expense` input, verify rendered HTML, click buttons, assert emitted values. No mocking needed.

### 3.4 When to Break the Rule

Some components inject `MatDialog` or `MatSnackBar` directly. This is acceptable when:
- The injected service is **UI infrastructure**, not business logic
- The component is making a local UI decision (e.g., "open a tooltip"), not a business decision

The key boundary: **no store or HTTP service injection in presentational components**. If a component needs to fetch data or update application state, it should emit an event and let the parent page handle it.

In this codebase, dialogs are always opened from **pages** (containers), never from presentational components. The `ConfirmDialogComponent` itself is a shared presentational component — it receives data via `MAT_DIALOG_DATA` input and returns a boolean result. The page decides what to do with that result.

---

## 4. Signal Store Pattern (Custom State Management)

### 4.1 Why Not NgRx

This is the most common interview question about the frontend architecture. Here is a structured comparison:

| Criterion | NgRx | Custom Signal Stores (this project) |
|---|---|---|
| **Boilerplate** | High — each feature needs: actions file, reducer file, effects file, selectors file, facade (optional). A simple CRUD feature generates 5+ files and 200+ lines of ceremony. | Low — one class with signals and methods. A CRUD feature is ~50-80 lines in one file. |
| **Learning curve** | Steep — requires understanding Redux concepts (actions, reducers, effects, selectors), immutability, RxJS operators for effects (`switchMap`, `exhaustMap`, `catchError`). | Gentle — requires understanding Angular signals (`signal`, `computed`, `effect`) and basic `Observable.subscribe()`. |
| **Bundle size** | +50-80KB for `@ngrx/store` + `@ngrx/effects` + `@ngrx/entity` | 0KB extra — signals are built into `@angular/core` |
| **DevTools** | Excellent — Redux DevTools with time-travel debugging, action replay, state diff | None — but signal values are inspectable via Angular DevTools' component inspector |
| **Type safety** | Good but verbose — action creators need typed payloads, selectors need typed return values, effects need typed action matching | Excellent and concise — signal types are inferred from initial values, methods are plain TypeScript |
| **Scalability** | Proven for massive apps (100+ features, complex cross-feature workflows) | Adequate for moderate apps (< 20 features with mostly independent state) |
| **Testability** | Well-established but verbose — mock store, dispatch actions, assert selectors | Simpler — call methods, read signals directly, assert values |
| **Middleware** | Meta-reducers can intercept all state changes (logging, hydration, undo/redo) | None — must be done manually per store |
| **Entity management** | `@ngrx/entity` provides adapter for collection CRUD (add, update, remove, select) | Manual — use array spread, filter, map |

**Bottom line**: For an app with **7 stores** and mostly independent feature state, NgRx adds ceremony without proportional benefit. Each store manages one feature's data, there's no complex cross-feature coordination, and there's no need for action logging or time-travel debugging.

**When NgRx would become justified**: If the app grew to 30+ features with complex cross-feature workflows (e.g., "when approval is accepted, update shared-expense list, dashboard totals, and settlement calculation simultaneously"), or if the team needed strict audit logging, undo/redo, or action replay for debugging production issues.

### 4.2 Also Considered (Brief Mentions)

| Library | Why Not |
|---|---|
| **NgRx ComponentStore** | Closer to our pattern (service-based, per-feature), but still RxJS-heavy internally. At the time of decision, it had no signals integration — it exposed `Observable` selectors, requiring `async` pipe in templates. |
| **NgRx SignalStore** | The newest NgRx option. Closer to what we built, but adds a dependency for essentially the same pattern we already have. Our custom stores predate its stable release. |
| **Akita** | Simpler than NgRx, but the ecosystem is dying (no updates since 2023). Not updated for Angular signals. |
| **Elf** | Modern, lightweight, but niche community. Hard to find help, risky bus-factor dependency. |
| **TanStack Query (Angular adapter)** | Excellent for server-state caching (automatic refetching, cache invalidation, optimistic updates). Was very new and experimental for Angular at time of decision. Would be a strong candidate if starting today, especially for the dashboard and list views. |

### 4.3 Store Architecture Deep Dive

Here is the **complete** `PersonalExpenseStore` — the pattern that all 7 stores follow:

```typescript
// frontend/src/app/features/personal-expenses/stores/personal-expense.store.ts

@Injectable({ providedIn: 'root' })
export class PersonalExpenseStore {
  // ── Dependencies ────────────────────────────────────────────────
  private readonly service = inject(PersonalExpenseService);
  private readonly paymentService = inject(ExpensePaymentService);
  private readonly snackBar = inject(MatSnackBar);

  // ── 1. State signals (mutable, writable) ────────────────────────
  readonly expenses = signal<Expense[]>([]);
  readonly paymentStatuses = signal<Map<string, PaymentStatus>>(new Map());
  readonly selectedExpense = signal<Expense | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── 2. Computed signals (derived, read-only) ────────────────────
  readonly totalMonthly = computed(() =>
    this.expenses().reduce((sum, e) => sum + e.amount, 0),
  );

  readonly paidTotal = computed(() => {
    const statuses = this.paymentStatuses();
    return this.expenses()
      .filter(e => statuses.get(e.id) === PaymentStatus.PAID)
      .reduce((sum, e) => sum + e.amount, 0);
  });

  readonly remainingBudget = computed(() =>
    this.totalMonthly() - this.paidTotal(),
  );

  // ── 3. Action methods ──────────────────────────────────────────
  loadExpenses(month?: number, year?: number): void {
    this.loading.set(true);
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    this.service.list(m, y).subscribe({
      next: e => {
        this.expenses.set(e);
        this.loading.set(false);
        this.loadBatchPaymentStatuses(m, y);
      },
      error: () => {
        this.expenses.set([]);
        this.loading.set(false);
      },
    });
  }

  createExpense(dto: CreateExpenseRequest, month?: number, year?: number,
                onSuccess?: () => void): void {
    this.loading.set(true);
    this.service.create(dto).subscribe({
      next: () => {
        this.snackBar.open('Expense created', '', { duration: 3000 });
        this.loading.set(false);
        this.loadExpenses(month, year);  // ◄ reload list after create
        onSuccess?.();                   // ◄ callback for navigation
      },
      error: err => {
        this.snackBar.open(err.error?.message ?? 'Failed to create', '',
                           { duration: 4000 });
        this.error.set(err.error?.message);
        this.loading.set(false);
      },
    });
  }

  // updateExpense, deleteExpense follow the same pattern...

  markPaid(expenseId: string, month: number, year: number): void {
    this.paymentService.markPaid(expenseId, { month, year }).subscribe({
      next: p => {
        this.updatePaymentMap(expenseId, p.status);
        this.snackBar.open('Marked as paid', '', { duration: 2000 });
      },
      error: err =>
        this.snackBar.open(err.error?.message ?? 'Failed', '',
                           { duration: 4000 }),
    });
  }

  // ── 4. Private helpers ─────────────────────────────────────────
  private loadBatchPaymentStatuses(month: number, year: number): void {
    this.paymentService.getBatchStatuses(month, year).subscribe({
      next: statuses => {
        const map = new Map<string, PaymentStatus>();
        for (const s of statuses) map.set(s.expenseId, s.status);
        this.paymentStatuses.set(map);   // ◄ new Map reference
      },
      error: () => {},
    });
  }

  private updatePaymentMap(expenseId: string, status: PaymentStatus): void {
    this.paymentStatuses.update(m => {
      const next = new Map(m);           // ◄ new reference for signal detection
      next.set(expenseId, status);
      return next;
    });
  }
}
```

#### Annotated walkthrough

**1. State signals** — Each piece of mutable state is a separate `signal<T>()`:

- `expenses` — the list of expenses for the current month
- `paymentStatuses` — a Map from expense ID to payment status
- `selectedExpense` — the expense currently being viewed/edited
- `loading` — whether an HTTP request is in flight
- `error` — the last error message (for display or retry logic)

**Why `signal<T>()` instead of `BehaviorSubject<T>`**: Signals provide synchronous reads (`store.expenses()` returns the value immediately, no `.getValue()` or `.subscribe()`), automatic change detection notification (no `markForCheck()`, no `async` pipe), and a simpler API (`.set()`, `.update()` instead of `.next()`, `.pipe()`).

**Why separate signals instead of one big state object**: Fine-grained reactivity. When `loading` changes from `true` to `false`, only components reading `loading()` are notified. The `expenses` signal hasn't changed, so components only reading expenses aren't re-checked. With a single state object, every property change would create a new object reference and notify everything.

**2. Computed signals** — Derived state that auto-recalculates:

- `totalMonthly` depends on `expenses` — recalculates when expenses change
- `paidTotal` depends on `expenses` AND `paymentStatuses` — recalculates when either changes
- `remainingBudget` depends on `totalMonthly` AND `paidTotal` — chains computed signals

Computed signals are **lazy**: the value is only recalculated when it's actually **read** and a dependency has changed. If no component reads `remainingBudget()` this render cycle, it won't recalculate even if `expenses` changed. Compare to NgRx selectors — same concept, but computed signals infer dependencies automatically (no need to list them like `createSelector(selectExpenses, selectPayments, ...)`).

**3. Action methods** — Public methods that components call. Each follows the same pattern:

1. Set `loading` to `true`
2. Call the service method (returns `Observable`)
3. `subscribe()` with `next` (success) and `error` (failure) handlers
4. On success: update signals, show snackbar, optionally reload related data
5. On failure: show error snackbar, set error signal, reset loading

**Why subscribe in the store, not in components**: Centralized state management. The store is the single source of truth — it's responsible for deciding how to update state after an API call. If we subscribed in components, different components could handle the same response differently, leading to inconsistent state.

**The `onSuccess` callback pattern**: Methods like `createExpense` accept an optional `onSuccess` callback. The page passes `() => router.navigate(...)` so that navigation only happens after the store confirms success. This keeps navigation logic in the page while keeping state updates in the store.

**4. Immutable updates** — The `updatePaymentMap` helper creates a **new Map** reference:

```typescript
this.paymentStatuses.update(m => {
  const next = new Map(m);    // ◄ copies all entries into a new Map
  next.set(expenseId, status);
  return next;                 // ◄ new reference ≠ old reference → signal detects change
});
```

Signals use **referential equality** (`===`) to detect changes. `map.set()` mutates the same object — same reference — so the signal thinks nothing changed. Creating `new Map(m)` produces a new reference that triggers the signal. This is the same immutability principle that NgRx enforces via reducers, except here it's manual and explicit.

### 4.4 Signal Lifecycle and Reactivity

Here's how signals propagate changes through the dependency graph:

```
expenses.set([...newExpenses])               ← direct write
    │
    ├──▶ totalMonthly recomputes             ← depends on expenses
    │       │
    │       └──▶ remainingBudget recomputes  ← depends on totalMonthly + paidTotal
    │
    └──▶ template bindings re-evaluate       ← store.expenses() in template
            │
            └──▶ Angular marks component dirty → re-renders on next CD cycle
```

**No manual subscription** — components read `store.expenses()` in templates; Angular's signal-aware change detection automatically detects the read dependency and schedules re-rendering when the signal changes.

**No `async` pipe** — signals are synchronous. `store.expenses()` returns `Expense[]` directly, not `Observable<Expense[]>`.

**No `markForCheck()`** — OnPush components are automatically marked dirty when a signal they read changes. This is the fundamental shift from Zone.js-era Angular where you needed explicit `ChangeDetectorRef.markForCheck()` after async operations.

### 4.5 Store Conventions (Pattern Consistency)

All 7 stores follow these conventions:

| Convention | Value | Why |
|---|---|---|
| `@Injectable({ providedIn: 'root' })` | Singleton, tree-shakable | If a feature is never imported, its store is dropped from the bundle. Root-level because stores outlive component navigation (preserving state across route changes within a feature). |
| State: `signal<T>(initialValue)` | One signal per piece of mutable state | Fine-grained reactivity. Separate `loading` from `data` from `error`. |
| Derived: `computed(() => ...)` | For any value calculated from state | Automatic dependency tracking, lazy evaluation, memoized. |
| Actions: public methods | Named like verbs: `loadExpenses`, `createExpense`, `deleteExpense` | Clear API. Components call methods, not dispatch string-typed actions. |
| No constructor logic | Stores are inert until a page calls a load method | Avoids unnecessary API calls. Dashboard store doesn't load until user visits `/dashboard`. |

---

## 5. Reactive Programming — Observables vs Signals

### 5.1 Decision Framework

The codebase uses **both** Observables (RxJS) and Signals (Angular), each for specific use cases. The decision is not "one or the other" but "which is the right tool for this job."

| Use Case | Mechanism | Why |
|---|---|---|
| Component/template state | `signal()` | Synchronous reads, no subscription management, automatic change detection |
| Derived/computed UI state | `computed()` | Automatic dependency tracking, lazy, memoized |
| Side effects on state change | `effect()` | Runs when signal dependencies change (e.g., ThemeService applies CSS class) |
| HTTP requests | `Observable<T>` | Inherently async, cancellable, retryable. HttpClient returns Observable by design. |
| Interceptor token refresh logic | `Observable` chain with RxJS operators | Complex async flow (refresh queue) needs `switchMap`, `filter`, `take`, `BehaviorSubject` |
| Layout breakpoints | `Observable` → `toSignal()` | CDK's `BreakpointObserver` emits Observable; bridge to signal for template use |
| Dialog results | `Observable` | `MatDialog.afterClosed()` returns Observable by design |
| Component cleanup | `takeUntilDestroyed()` | Automatic unsubscription tied to component lifecycle |

**General rule**: Use **signals** for state that templates read. Use **observables** for async operations (HTTP, events, streams) and convert to signals via `toSignal()` when the template needs the result.

### 5.2 The Bridge Pattern: `toSignal()`

When an external library emits Observables but your template consumes signals, `toSignal()` bridges the gap:

```typescript
// frontend/src/app/core/layout/shell.component.ts (excerpt)

readonly isDesktop = toSignal(
  this.breakpointObserver.observe('(min-width: 1024px)').pipe(
    map(result => result.matches),
  ),
  { initialValue: false },
);
```

**What's happening**:
1. `BreakpointObserver.observe()` returns `Observable<BreakpointState>` — emits whenever viewport crosses the breakpoint
2. `map(result => result.matches)` transforms to `Observable<boolean>`
3. `toSignal()` subscribes internally and exposes the latest value as a `Signal<boolean>`
4. `{ initialValue: false }` makes the type `boolean` (not `boolean | undefined`) — avoids null checks in templates
5. Auto-unsubscribes when the component is destroyed (tied to injection context)

**Usage in template** — no `async` pipe, no subscription:
```html
<mat-sidenav [mode]="isDesktop() ? 'side' : 'over'"
             [opened]="isDesktop()">
```

**When NOT to use `toSignal()`**:
- For HTTP requests that should not auto-subscribe on creation (`toSignal` subscribes immediately)
- When you need manual control over subscription timing (e.g., only fetch after a button click)
- In services without an injection context (`toSignal` requires one for cleanup)

### 5.3 Higher-Order Observables

Higher-order observables are observables that emit or operate on other observables. The codebase uses them in two critical places.

#### Example 1: Auth Interceptor Refresh Queue

This is the most complex RxJS code in the frontend. It solves a real-world problem: **what happens when multiple API requests fail with 401 simultaneously?**

```typescript
// frontend/src/app/core/auth/auth.interceptor.ts

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const AUTH_URLS = [
  '/auth/login', '/auth/register', '/auth/refresh',
  '/auth/verify-code', '/auth/resend-code',
  '/auth/forgot-password', '/auth/reset-password',
];

function isAuthUrl(url: string): boolean {
  return AUTH_URLS.some(authUrl => url.includes(authUrl));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);

  // Don't add auth headers to auth endpoints (they handle their own auth)
  if (isAuthUrl(req.url)) return next(req);

  const token = tokenService.getAccessToken();
  const authedReq = token ? addToken(req, token) : req;

  return next(authedReq).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handle401(req, next, tokenService, authService);
      }
      return throwError(() => error);
    }),
  );
};

function handle401(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  tokenService: TokenService,
  authService: AuthService,
) {
  if (!isRefreshing) {
    // ── FIRST 401: Start the refresh ──────────────────────────────
    isRefreshing = true;
    refreshTokenSubject.next(null);   // signal "refresh in progress"

    const refreshToken = tokenService.getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      authService.clearAuth();
      return throwError(() => new Error('No refresh token'));
    }

    return authService.refresh().pipe(
      switchMap(res => {
        isRefreshing = false;
        refreshTokenSubject.next(res.accessToken);  // unblocks queued requests
        return next(addToken(req, res.accessToken)); // retry original request
      }),
      catchError(err => {
        isRefreshing = false;
        authService.clearAuth();                     // refresh failed → logout
        return throwError(() => err);
      }),
    );
  }

  // ── CONCURRENT 401s: Wait for the refresh to complete ─────────
  return refreshTokenSubject.pipe(
    filter(token => token !== null),  // wait until a real token arrives
    take(1),                          // complete after receiving one token
    switchMap(token => next(addToken(req, token!))),  // retry with new token
  );
}
```

**Step-by-step flow diagram**:

```
Time ──────────────────────────────────────────────────────────►

Request A fails 401 ─┐
                      ├─ isRefreshing = false → starts refresh
                      │  refreshTokenSubject.next(null)
                      │  authService.refresh() ──── waiting... ──── success!
                      │                                              │
                      │                              refreshTokenSubject.next(newToken)
                      │                              isRefreshing = false
                      │                              retry A with newToken ──► A succeeds
                      │
Request B fails 401 ──┤
                      ├─ isRefreshing = true → enters else block
                      │  subscribes to refreshTokenSubject
                      │  filter(token !== null) → waits...
                      │                              │
                      │                              gets newToken (from A's refresh)
                      │                              take(1) → completes
                      │                              retry B with newToken ──► B succeeds
                      │
Request C fails 401 ──┘
                      (same as B — waits for the same token)
```

**Why `BehaviorSubject` + `filter` + `take(1)` instead of a plain `Subject`**:

- **`BehaviorSubject`** stores the last emitted value. If a request's 401 handler subscribes *after* the refresh completes, it immediately gets the token. A plain `Subject` would miss it and hang forever.
- **`filter(token !== null)`** ensures requests don't retry with a null/stale token. During refresh, `null` is emitted to signal "in progress" — requests skip that emission and wait for the real token.
- **`take(1)`** auto-completes the subscription after receiving one token. Without it, the subscription would leak — every future token refresh would cause the request to retry again.

This is a standard **token refresh queue pattern** used across many production Angular applications. It handles the race condition of multiple concurrent 401s without multiple refresh requests.

#### Example 2: App Initializer Chain

```typescript
// From app.config.ts (see Section 1.2)
return authService.refresh().pipe(
  switchMap(() => authService.loadCurrentUser()),
  catchError(() => of(null)),
);
```

**Why `switchMap` instead of `mergeMap` or `concatMap`**:

| Operator | Behavior | Why (not) used |
|---|---|---|
| `switchMap` | Cancels previous inner Observable when new outer emission arrives | **Used** — if somehow a second refresh fires, cancel the first. Defensive. Also, the operations are sequential (can't load user without token). |
| `mergeMap` | Runs inner Observables in parallel | Not used — we need sequential execution (refresh THEN load user), not parallel. |
| `concatMap` | Queues inner Observables sequentially | Would also work here. `switchMap` is preferred because it cancels rather than queues — more defensive for auth flows where stale requests should be discarded. |
| `exhaustMap` | Ignores new outer emissions while inner is running | Could work but `switchMap` is more appropriate — we want the latest refresh result, not to ignore it. |

### 5.4 RxJS Operators Used in the Project

| Operator | Where Used | What It Does |
|---|---|---|
| `map` | Interceptor, breakpoint observer, auth flows | Transforms emitted values (e.g., `BreakpointState` → `boolean`) |
| `switchMap` | Interceptor refresh chain, app initializer | Chains sequential async operations, cancels previous |
| `catchError` | Interceptor, app initializer, store error handling | Catches errors in the stream, returns fallback or re-throws |
| `filter` | Interceptor token queue | Skips emissions that don't match a predicate |
| `take` | Interceptor token queue | Completes after N emissions (prevents memory leaks) |
| `throwError` | Interceptor | Creates an Observable that immediately errors |
| `of` | App initializer fallback | Creates an Observable that immediately emits a value and completes |
| `BehaviorSubject` | Interceptor refresh synchronization | Subject that stores and replays the last emitted value |
| `takeUntilDestroyed` | Dialog afterClosed subscriptions | Auto-unsubscribes when component's `DestroyRef` fires |

**Notable absence**: We do NOT use `debounceTime`, `distinctUntilChanged`, `combineLatest`, `forkJoin`, or `merge`. This is intentional — signals handle most of what these operators would do (debouncing via `effect`, combining via `computed`, distinct checking via signal equality). The `tap` operator is used in `AuthService` for side effects (storing tokens). The remaining RxJS usage is limited to HTTP flow control where Observables are the right tool.

---

## 6. Auth Architecture

### 6.1 Token Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                       TOKEN STORAGE STRATEGY                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Access Token:   stored IN-MEMORY (TokenService.accessToken field)  │
│  Refresh Token:  stored in localStorage                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
// frontend/src/app/core/auth/token.service.ts

const REFRESH_TOKEN_KEY = 'sb_refresh_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private accessToken: string | null = null;  // ◄ IN-MEMORY ONLY

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);  // ◄ localStorage
    } catch {
      return null;
    }
  }

  setRefreshToken(token: string): void {
    try {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } catch {
      // localStorage not available (incognito, SSR)
    }
  }

  clearTokens(): void {
    this.accessToken = null;
    try {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {}
  }

  isAccessTokenExpired(): boolean {
    const token = this.accessToken;
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}
```

#### Security reasoning

| Decision | Rationale |
|---|---|
| **Access token in memory** | NOT accessible via XSS reading `localStorage` or `document.cookie`. If an attacker injects a script, they cannot extract the access token from a private class field. Lost on page refresh — by design (refreshed silently via `provideAppInitializer`). |
| **Refresh token in localStorage** | Survives page refresh, enabling silent re-authentication. XSS risk is mitigated because: (1) the refresh endpoint returns a *new* short-lived access token, so a stolen refresh token has limited window; (2) the backend rotates refresh tokens on each use (old one is invalidated). |
| **Why not httpOnly cookies** | Would require backend and frontend on the same domain (or complex CORS cookie config). The backend uses a Bearer token auth pattern. httpOnly cookies also prevent the frontend from inspecting token expiry for proactive refresh. |
| **Token rotation** | On every refresh, the backend issues a new access token AND a new refresh token, invalidating the old refresh token. This limits the damage window if a refresh token is compromised. |
| **`try/catch` around localStorage** | localStorage is unavailable in some environments (certain incognito modes, SSR, storage quota exceeded). Graceful degradation — the app falls back to requiring re-login. |

### 6.2 Auth Flow Diagram

```
1. LOGIN
   ┌──────────┐     POST /auth/login     ┌──────────┐
   │   User   │ ──────────────────────── │  Backend  │
   │  submits │                           │  returns  │
   │  form    │ ◄─── { accessToken,  ──── │  JWT pair │
   └──────────┘      refreshToken }       └──────────┘
        │
        ├─ TokenService.setAccessToken(accessToken)    ◄ in-memory
        ├─ TokenService.setRefreshToken(refreshToken)  ◄ localStorage
        └─ Router navigates to /household (default)

2. PAGE REFRESH (browser reload)
   provideAppInitializer runs
        │
        ├─ tokenService.getRefreshToken()  →  found in localStorage
        │
        ├─ authService.refresh()  →  POST /auth/refresh
        │       │
        │       └─ switchMap ──►  authService.loadCurrentUser()
        │                              │
        │                              └─ GET /users/me
        │                                    │
        │                                    └─ currentUser signal updated
        │
        └─ App bootstrap completes, user is authenticated

3. API REQUEST (normal flow)
   Component → Store → Service → ApiService → HttpClient
        │                                          │
        │                          Interceptor adds Authorization header
        │                                          │
        │                          If 401: handle401() (see Section 5.3)
        │                              │
        │                              ├─ Refresh token → retry request
        │                              └─ No token → clearAuth() → login page
        │
        └─ Store updates signals → component re-renders

4. LOGOUT
   User clicks logout
        │
        ├─ POST /auth/logout (backend invalidates refresh token)
        ├─ TokenService.clearTokens() (removes both tokens)
        ├─ AuthService.currentUser.set(null)
        └─ Router.navigate(['/auth/login'])
```

### 6.3 Auth Guard

```typescript
// frontend/src/app/core/auth/auth.guard.ts

export const authGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.getAccessToken() || tokenService.getRefreshToken()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
```

**Design decisions**:

| Decision | Why |
|---|---|
| **Functional guard** (`CanActivateFn`) | Simpler than class-based guards (no `@Injectable`, no `implements CanActivate`). Tree-shakable. Angular's recommended approach since v15. |
| **Checks for EITHER token** | `getAccessToken() \|\| getRefreshToken()` — even if the access token is gone (page refresh), the refresh token alone is sufficient because `provideAppInitializer` will have already refreshed it. The guard runs AFTER the initializer completes. |
| **Returns `UrlTree`** (not `false`) | Returning `UrlTree` tells the router to redirect rather than just block navigation. Includes `returnUrl` as a query parameter so the login page can redirect back after successful authentication. |
| **Applied on the shell route** | The guard is set on `path: ''` (the shell route) in `app.routes.ts` — this single guard declaration protects ALL authenticated pages (dashboard, expenses, salary, etc.) without repeating it per feature. Auth routes (`path: 'auth'`) are outside the shell, so they're always accessible. |

### 6.4 AuthService Signals

```typescript
// frontend/src/app/core/auth/auth.service.ts

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiUrl;

  // ── Signals (app-wide auth state) ──────────────────────────────
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isLoading = signal(false);

  login(dto: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/login`, dto).pipe(
      tap(res => this.handleAuthResponse(res)),  // ◄ store tokens
    );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {
      refreshToken,
    } as RefreshTokenRequest).pipe(
      tap(res => this.handleAuthResponse(res)),
    );
  }

  logout(): Observable<MessageResponse> {
    const refreshToken = this.tokenService.getRefreshToken();
    return this.http.post<MessageResponse>(`${this.baseUrl}/auth/logout`,
      { refreshToken }).pipe(
      tap(() => {
        this.tokenService.clearTokens();
        this.currentUser.set(null);
        this.router.navigate(['/auth/login']);
      }),
    );
  }

  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/users/me`).pipe(
      tap(user => this.currentUser.set(user)),
    );
  }

  clearAuth(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
  }

  private handleAuthResponse(res: AuthResponse): void {
    this.tokenService.setAccessToken(res.accessToken);
    this.tokenService.setRefreshToken(res.refreshToken);
  }
}
```

**Why AuthService uses HttpClient directly (not ApiService)**: `AuthService` lives in `core/auth/` and handles its own URL construction because auth endpoints have special requirements — they're excluded from the interceptor's token injection (see `AUTH_URLS` list in Section 5.3). Using `ApiService` would add an unnecessary layer since auth endpoints don't follow the same pattern as feature endpoints.

**Signal usage**: Components anywhere in the app can read `authService.isAuthenticated()` or `authService.currentUser()` in templates. Changes propagate automatically — when `logout()` sets `currentUser` to `null`, every component reading `isAuthenticated()` immediately re-renders. No event bus, no broadcast service, no subscription management.

---

## 7. Routing and Lazy Loading

### 7.1 Route Architecture

```typescript
// frontend/src/app/app.routes.ts

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    loadComponent: () =>
      import('./core/layout/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'household', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes')
            .then(m => m.DASHBOARD_ROUTES),
      },
      {
        path: 'expenses/personal',
        loadChildren: () =>
          import('./features/personal-expenses/personal-expenses.routes')
            .then(m => m.PERSONAL_EXPENSE_ROUTES),
      },
      {
        path: 'expenses/shared',
        loadChildren: () =>
          import('./features/shared-expenses/shared-expenses.routes')
            .then(m => m.SHARED_EXPENSE_ROUTES),
      },
      {
        path: 'approvals',
        loadChildren: () =>
          import('./features/approvals/approvals.routes')
            .then(m => m.APPROVAL_ROUTES),
      },
      {
        path: 'salary',
        loadChildren: () =>
          import('./features/salary/salary.routes')
            .then(m => m.SALARY_ROUTES),
      },
      {
        path: 'savings',
        loadChildren: () =>
          import('./features/savings/savings.routes')
            .then(m => m.SAVINGS_ROUTES),
      },
      {
        path: 'household',
        loadChildren: () =>
          import('./features/household/household.routes')
            .then(m => m.HOUSEHOLD_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes')
            .then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'household' },
];
```

**Structure explained**:

| Route | Purpose |
|---|---|
| `path: 'auth'` | Public routes (login, register, etc.). No guard — always accessible. Own layout (no shell). |
| `path: ''` with `ShellComponent` | Protected routes. `canActivate: [authGuard]` checks tokens. `ShellComponent` provides toolbar + sidenav. |
| `children: [...]` | 8 feature route groups + default redirect. Each uses `loadChildren` for lazy loading. |
| `path: '**'` | Wildcard catch-all redirects unknown URLs to `/household` (the default landing page). |

### 7.2 Lazy Loading Strategy

Each `loadChildren: () => import(...)` call creates a **separate JavaScript chunk** at build time. The browser only downloads a chunk when the user navigates to that feature.

```
Initial load:                         Lazy chunks (on demand):
┌──────────────────────┐              ┌────────────────────────┐
│ main.js              │              │ chunk-auth.js          │
│ - AppComponent       │              │ chunk-dashboard.js     │
│ - app.routes.ts      │              │ chunk-personal-exp.js  │
│ - core/ (auth, API,  │              │ chunk-shared-exp.js    │
│   error, layout,     │              │ chunk-approvals.js     │
│   theme)             │              │ chunk-salary.js        │
│ - shared/ (pipes,    │              │ chunk-savings.js       │
│   components, etc.)  │              │ chunk-household.js     │
└──────────────────────┘              │ chunk-settings.js      │
                                      └────────────────────────┘
```

**Concrete benefit**: If a user only uses dashboard and personal-expenses, they never download the salary, savings, household management, or settings code. This reduces initial page load time and data usage.

**`loadComponent` vs `loadChildren`**:
- `loadComponent` is used for the shell (a single component that wraps all children)
- `loadChildren` is used for feature route arrays (which may define multiple pages and sub-routes)

### 7.3 Shell Pattern

The shell route pattern separates layout from content:

```
app.routes.ts
│
├── 'auth'  →  Own layout (no toolbar, no sidenav)
│   ├── 'login'
│   ├── 'register'
│   ├── 'verify-code'
│   ├── 'forgot-password'
│   └── 'reset-password'
│
└── '' (ShellComponent)  →  [authGuard] protects everything below
    │
    │  ┌──────────────────────────────────────────┐
    │  │  ┌─────────────────────────────────────┐ │
    │  │  │         ToolbarComponent             │ │
    │  │  └─────────────────────────────────────┘ │
    │  │  ┌────────┐ ┌─────────────────────────┐  │
    │  │  │Sidenav │ │    <router-outlet />     │  │
    │  │  │  nav   │ │                          │  │
    │  │  │ links  │ │  ◄─ Feature pages render │  │
    │  │  │        │ │     here                 │  │
    │  │  └────────┘ └─────────────────────────┘  │
    │  └──────────────────────────────────────────┘
    │
    ├── 'dashboard'          → DashboardComponent
    ├── 'expenses/personal'  → PersonalExpenseList/Form/Timeline
    ├── 'expenses/shared'    → SharedExpenseList/Form/Timeline
    ├── 'approvals'          → ApprovalListComponent
    ├── 'salary'             → SalaryOverviewComponent
    ├── 'savings'            → SavingsOverviewComponent
    ├── 'household'          → HouseholdDetail/MemberDetail/Invitations
    └── 'settings'           → SettingsComponent
```

**Why this pattern**:
- The shell (`toolbar + sidenav + content area`) is defined **once**, not repeated in every feature
- Auth pages have their own distinct layout (centered card, no navigation) — they don't need the shell
- Adding a new feature is trivial: add one `loadChildren` entry and the shell automatically wraps it

### 7.4 `withComponentInputBinding()`

Configured in `provideRouter(routes, withComponentInputBinding())`, this feature automatically binds route parameters to component `input()` properties by matching names.

**Before** (traditional approach):
```typescript
// Without withComponentInputBinding — verbose
export class ExpenseEditPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  id = '';

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.id = params.get('id') ?? '';
    });
  }
}
```

**After** (with component input binding):
```typescript
// With withComponentInputBinding — concise
export class ExpenseEditPage {
  readonly id = input.required<string>();  // ◄ automatically bound from :id route param
}
```

This eliminates the need to inject `ActivatedRoute`, subscribe to `paramMap`, and manage the subscription lifecycle. The `input()` signal is automatically populated from the route parameter with the same name.

---

## 8. API Layer Design

### 8.1 Centralized ApiService

```typescript
// frontend/src/app/core/api/api.service.ts

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body?: unknown, params?: HttpParams): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { params });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }
}
```

**Design decisions**:

| Decision | Why |
|---|---|
| **Single `baseUrl`** from environment | Configured once, used everywhere. Switching between dev/staging/prod is an environment variable change, not a code change. |
| **Generic methods** (`get<T>`, `post<T>`, etc.) | Type parameter `T` flows through to the caller, providing end-to-end type safety from API call to template without casts. |
| **Returns `Observable<T>`** | Does NOT subscribe — lets the caller (store or component) decide when and how to handle the response. This is the key principle: the API layer is a data pipe, not a data consumer. |
| **Does NOT add auth headers** | That's the interceptor's job (separation of concerns). ApiService is unaware of auth. |
| **Does NOT handle errors globally** | That's the GlobalErrorHandler's job (or the store's job for expected errors). ApiService just passes Observables through. |
| **Single responsibility** | URL construction and HTTP method dispatch. Nothing else. |

### 8.2 Feature Service Layer Pattern

Every feature has a thin service that wraps `ApiService` with endpoint-specific methods:

```typescript
// frontend/src/app/features/personal-expenses/services/personal-expense.service.ts

@Injectable({ providedIn: 'root' })
export class PersonalExpenseService {
  private readonly api = inject(ApiService);

  list(month?: number, year?: number): Observable<Expense[]> {
    let params = new HttpParams();
    if (month) params = params.set('month', month);
    if (year) params = params.set('year', year);
    return this.api.get<Expense[]>('/expenses/personal', params);
  }

  get(id: string): Observable<Expense> {
    return this.api.get<Expense>(`/expenses/personal/${id}`);
  }

  create(dto: CreateExpenseRequest): Observable<Expense> {
    return this.api.post<Expense>('/expenses/personal', dto);
  }

  update(id: string, dto: UpdateExpenseRequest): Observable<Expense> {
    return this.api.put<Expense>(`/expenses/personal/${id}`, dto);
  }

  delete(id: string): Observable<MessageResponse> {
    return this.api.delete<MessageResponse>(`/expenses/personal/${id}`);
  }
}
```

**Pattern rules**:
- Injects `ApiService` (not `HttpClient` directly) — single point of change for base URL or request config
- Returns `Observable<T>` — does NOT subscribe. Subscription happens in the store only.
- `providedIn: 'root'` — tree-shakable singleton. If a feature is never imported, its service is dropped.
- Methods are named like REST operations: `list`, `get`, `create`, `update`, `delete`
- Each method constructs the URL path and optional query params, nothing more

### 8.3 Data Flow Chain

The complete data flow from user interaction to API and back:

```
┌──────────────────────────────────────────────────────────────────┐
│                         DATA FLOW CHAIN                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User clicks "Add Expense"                                       │
│       │                                                          │
│       ▼                                                          │
│  ExpenseFormPage (container) calls store.createExpense(dto)      │
│       │                                                          │
│       ▼                                                          │
│  PersonalExpenseStore sets loading=true,                         │
│    calls service.create(dto)  →  returns Observable              │
│       │                                                          │
│       ▼                                                          │
│  PersonalExpenseService calls api.post('/expenses/personal', dto)│
│       │                                   →  returns Observable  │
│       ▼                                                          │
│  ApiService calls http.post(baseUrl + path, dto)                 │
│       │                                   →  returns Observable  │
│       ▼                                                          │
│  Interceptor adds Authorization header → HttpClient sends request│
│       │                                                          │
│       ▼                                                          │
│  Backend processes → returns Expense                             │
│       │                                                          │
│       ▼                                                          │
│  Store's subscribe handler:                                      │
│    - snackBar.open('Expense created')                            │
│    - loading.set(false)                                          │
│    - loadExpenses() (refresh list)                               │
│    - onSuccess?.() (navigate back to list)                       │
│       │                                                          │
│       ▼                                                          │
│  expenses signal changes → computed signals recalculate          │
│       │                                                          │
│       ▼                                                          │
│  PersonalExpenseListPage template re-renders with new expense    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Each layer has exactly one job**:
- If the **API base URL** changes → only `environment.ts` changes
- If the **auth header format** changes → only the interceptor changes
- If the **error display** logic changes → only the store's subscribe handler changes
- If the **UI layout** of an expense changes → only `ExpenseCardComponent` changes

---

## 9. State Management Deep Dive

### 9.1 Signal Primitives Used

| Primitive | Purpose | Example | Behavior |
|---|---|---|---|
| `signal<T>(initial)` | Mutable state container | `expenses = signal<Expense[]>([])` | `.set(value)` replaces, `.update(fn)` transforms. Notifies consumers on change. |
| `computed(() => expr)` | Derived read-only state | `totalMonthly = computed(() => expenses().reduce(...))` | Auto-recalculates when dependencies change. Lazy — only recalculates when read. Memoized — returns cached value if dependencies haven't changed. |
| `effect(() => { ... })` | Side effect on signal change | `effect(() => { document.classList.toggle(...) })` | Runs after signals stabilize. Used in ThemeService for DOM manipulation. Automatically tracks dependencies. |
| `toSignal(obs$)` | Bridge Observable → Signal | `isDesktop = toSignal(breakpoint$.pipe(map(...)))` | Subscribes to Observable, exposes latest value as signal. Auto-unsubscribes on destroy. |

### 9.2 Immutability Requirement

Signals use **referential equality** (`===`) to detect changes. Mutating a value in place does NOT trigger updates because the reference hasn't changed.

```typescript
// ✗ WRONG — same reference, signal sees no change
this.expenses().push(newExpense);

// ✓ CORRECT — new array reference
this.expenses.set([...this.expenses(), newExpense]);

// ✓ ALSO CORRECT — using update() helper
this.expenses.update(prev => [...prev, newExpense]);

// For Maps: new Map() creates a new reference
this.paymentStatuses.update(m => {
  const next = new Map(m);       // ◄ copies entries into new Map
  next.set(expenseId, status);
  return next;                    // ◄ new reference triggers signal
});
```

This is the **same immutability principle** that NgRx enforces via reducers, except here it's manual and explicit. The tradeoff: less enforcement (no reducer to ensure immutability), but also less ceremony (no action→reducer→selector pipeline).

### 9.3 Store vs Component-Local State

| State belongs in... | When | Examples |
|---|---|---|
| **Store** (signal in `@Injectable` service) | Data shared across components, persists across navigation, fetched from server | `expenses`, `currentUser`, `loading`, `paymentStatuses` |
| **Component** (local `signal()`) | Form state, UI toggles, local filters, ephemeral UI values | `month`, `year` (MonthPicker selection), `isDialogOpen`, form field values |

**Example**: The expense list page has `month = signal(...)` and `year = signal(...)` as local state — these are page-scoped UI selections that don't need to persist if the user navigates away and back. The expenses themselves are in the store because they're fetched from the server and displayed by multiple child components.

### 9.4 Tradeoffs and Limitations

Honest assessment of what we lose compared to NgRx:

| What We Lose | Impact | Mitigation |
|---|---|---|
| **No time-travel debugging** | Cannot replay state transitions to find bugs | Angular DevTools shows current signal values. Logging in store methods helps trace flows. |
| **No action log** | Harder to trace *what* caused a state change | Store methods are explicit and named (`createExpense`, `deleteExpense`) — tracing is manual but straightforward. |
| **No middleware/meta-reducers** | Cannot intercept all state changes globally (e.g., for logging or hydration) | Not needed at this scale. If needed, each store method can call a shared utility. |
| **No entity adapter** | Must manually manage collections (add, update, remove by ID) | Standard array operations (`filter`, spread, `map`) are sufficient for our collection sizes (< 100 items per feature). |
| **No cross-store coordination** | Must manually coordinate when one store's action affects another | Not a frequent need. Where it occurs (e.g., creating a shared expense triggers approval refresh), the page component calls both stores. |

**When this would become a problem**: 20+ stores, complex cross-feature workflows (one action updating 5 stores), need for undo/redo, strict audit logging requirements, or large team where action-based traceability prevents debugging conflicts.

---

## 10. UI/UX Patterns

### 10.1 Material 3 Theming

Angular Material 21 uses **Material 3** (M3), Google's latest design system. Key differences from M2:
- **Tone-based color system**: Colors are generated as tonal palettes from seed colors
- **CSS custom properties**: Theming is done via CSS variables (not SCSS theming like M2)
- **Dynamic color**: Dark mode is a CSS class toggle, not a separate theme build

**Palettes used**:
- **Primary**: `mat.$cyan-palette` — main actions, toolbar, active navigation
- **Tertiary**: `mat.$orange-palette` — accents, secondary actions, highlights

The `mat.theme()` SCSS mixin generates ~200 CSS custom properties (e.g., `--mat-sys-primary`, `--mat-sys-on-primary`, `--mat-sys-surface-container`) that all Material components reference. Dark mode overrides these variables automatically when the `.dark-theme` class is applied.

### 10.2 Theme Service Implementation

```typescript
// frontend/src/app/core/theme/theme.service.ts

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sb-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly mode = signal<ThemeMode>(this.loadSaved());  // ◄ persisted
  readonly isDark = signal(false);

  constructor() {
    // ── effect(): React to mode changes ──────────────────────────
    effect(() => {
      const mode = this.mode();
      this.persist(mode);
      const dark = mode === 'dark'
                || (mode === 'system' && this.prefersDark());
      this.isDark.set(dark);
      if (this.isBrowser) {
        document.documentElement.classList.toggle('dark-theme', dark);
      }
    });

    // ── Listen for OS-level theme changes ────────────────────────
    if (this.isBrowser) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.mode() === 'system') {
            const dark = this.prefersDark();
            this.isDark.set(dark);
            document.documentElement.classList.toggle('dark-theme', dark);
          }
        });
    }
  }

  toggle(): void {
    const current = this.mode();
    if (current === 'light') this.mode.set('dark');
    else if (current === 'dark') this.mode.set('system');
    else this.mode.set('light');
  }

  private prefersDark(): boolean {
    return this.isBrowser
        && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private loadSaved(): ThemeMode {
    if (!this.isBrowser) return 'system';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  }

  private persist(mode: ThemeMode): void {
    if (this.isBrowser) localStorage.setItem(STORAGE_KEY, mode);
  }
}
```

**Key patterns**:

| Pattern | Explanation |
|---|---|
| **`effect()` for DOM side effects** | The `effect()` runs whenever `this.mode()` changes. It persists the choice, calculates whether dark mode should be active, and toggles the CSS class on `<html>`. This is the canonical use of `effect()` — executing side effects that live outside Angular's component model (DOM manipulation, localStorage). |
| **Three-way toggle**: light → dark → system → light | Most apps only offer light/dark. "System" respects the OS preference, which is increasingly common. The cycle provides discoverability. |
| **`prefers-color-scheme` listener** | If the user selects "system" mode and then changes their OS theme, the app updates immediately without requiring a page refresh. |
| **`isPlatformBrowser` check** | Guards against SSR or test environments where `document` and `window` don't exist. Even though this app is SPA-only, it's good practice for portability. |

### 10.3 Responsive Shell

```typescript
// frontend/src/app/core/layout/shell.component.ts

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, MatSidenavModule, ToolbarComponent, SidenavComponent],
  template: `
    <app-toolbar (menuToggle)="sidenavEl()?.toggle()" />
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav
        #sidenavRef
        [mode]="isDesktop() ? 'side' : 'over'"
        [opened]="isDesktop()"
        class="sidenav">
        <app-sidenav (navClick)="onNavClick()" />
      </mat-sidenav>
      <mat-sidenav-content class="content">
        <div class="content-wrapper">
          <router-outlet />
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .sidenav-container { flex: 1; }
    .sidenav { width: var(--sidenav-width); }
    .content-wrapper {
      padding: var(--space-lg);
      max-width: var(--content-max-width);
      margin: 0 auto;
    }
    @media (max-width: 1024px) {
      .content-wrapper { padding: var(--space-md); }
    }
    @media (max-width: 600px) {
      .content-wrapper { padding: var(--space-sm); }
    }
  `],
})
export class ShellComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  readonly sidenavEl = viewChild<MatSidenav>('sidenavRef');

  readonly isDesktop = toSignal(
    this.breakpointObserver.observe('(min-width: 1024px)').pipe(
      map(result => result.matches),
    ),
    { initialValue: false },
  );

  onNavClick(): void {
    if (!this.isDesktop()) {
      this.sidenavEl()?.close();  // ◄ auto-close sidenav on mobile after nav
    }
  }
}
```

**Responsive behavior**:

| Viewport | Sidenav Mode | Sidenav State | Content Padding |
|---|---|---|---|
| **Desktop** (> 1024px) | `'side'` (persistent, pushes content) | Always open | `var(--space-lg)` |
| **Tablet** (600-1024px) | `'over'` (overlay, covers content) | Closed by default, opened via hamburger | `var(--space-md)` |
| **Mobile** (< 600px) | `'over'` (overlay) | Closed by default | `var(--space-sm)` |

**Key implementation details**:
- `BreakpointObserver` from `@angular/cdk/layout` — emits when viewport crosses the 1024px breakpoint
- `toSignal()` bridges the Observable to a signal (see Section 5.2 for full explanation)
- `onNavClick()` — when user clicks a nav link on mobile, the sidenav auto-closes (otherwise it would block the content)
- `viewChild<MatSidenav>('sidenavRef')` — signal-based view query to access the sidenav element for programmatic control
- CSS variables (`--sidenav-width`, `--content-max-width`, `--space-lg/md/sm`) are defined globally and can be adjusted without touching component code

### 10.4 CSS Variable Architecture

Global CSS variables are defined in `styles.scss` and used by all components:

```
Global Level (styles.scss)               Component Level
┌──────────────────────────┐             ┌──────────────────────────┐
│ --sidenav-width: 260px   │ ─────────── │ width: var(--sidenav-    │
│ --content-max-width:     │             │         width);          │
│         1200px           │             │                          │
│ --space-lg: 24px         │ ─────────── │ padding: var(--space-lg) │
│ --space-md: 16px         │             │                          │
│ --space-sm: 8px          │             │ gap: var(--space-md)     │
│                          │             │                          │
│ /* M3 auto-generated */  │             │ background: var(--mat-   │
│ --mat-sys-primary: ...   │ ─────────── │   sys-surface-container) │
│ --mat-sys-surface: ...   │             │                          │
└──────────────────────────┘             └──────────────────────────┘
```

**Benefits**:
- **Consistency**: All spacing uses the same scale (`8px`, `16px`, `24px`)
- **Easy theming**: Dark mode overrides are handled by M3's generated variables
- **Responsive**: Media queries adjust padding variables, components adapt automatically
- **No hardcoded values**: Components reference `var(--space-md)` instead of `16px`

### 10.5 Shared UI Components

Brief explanation of each shared component and its role:

| Component | What It Does | Key Props | Used In |
|---|---|---|---|
| `LoadingSpinnerComponent` | Displays a centered Material progress spinner | None — pure display | Every feature list page (shown while `store.loading()` is `true`) |
| `EmptyStateComponent` | Shows a placeholder when a list has zero items | `icon`, `title`, `description`, optional action button via content projection | Expense lists, approval list, savings |
| `CurrencyDisplayComponent` | Formatted EUR display with green (positive) / red (negative) color | `amount: number` | Dashboard cards, expense summaries |
| `ConfirmDialogComponent` | Material dialog for destructive actions (delete, leave) | `data: { title, message, confirmText, color }` via `MAT_DIALOG_DATA` | Expense deletion, household leave, member removal |
| `PageHeaderComponent` | Consistent page title + subtitle + action slot | `title`, `subtitle`, content projection for actions | Every page component |
| `BaseChartComponent` | chart.js wrapper that auto-adapts colors to theme | `type`, `data`, `options` | Household finance charts, salary chart, savings chart |
| `MonthPickerComponent` | Month/year navigation with prev/next arrows | `selectedMonth`, `selectedYear`, emits `monthChange` | Expense lists, salary overview, timeline pages |

All components follow the presentational pattern: `input()` for data, `output()` for events, no injected services. They are in `shared/` because they're used by 2+ features and contain zero business logic.

---

## 11. Change Detection Strategy

### 11.1 OnPush Everywhere

Every component in the codebase uses:

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

**What OnPush means**: Angular only re-checks this component when:
1. An `input()` reference changes (new object/array reference, not mutation)
2. An event fires from the component or its children (click, keypress, etc.)
3. A signal the template reads notifies of a change
4. An Observable used with `async` pipe emits (not used in this project — signals replace this)

**What OnPush prevents**: Without OnPush (default strategy), Angular checks ALL components on every browser event (click anywhere, mousemove, setTimeout, HTTP response). In a tree of 50+ components, this means thousands of unnecessary checks per second. OnPush limits checks to only the components that actually have new data.

### 11.2 Zoneless Architecture

**What Zone.js does** (and why we removed it):

Zone.js monkey-patches every asynchronous browser API:
- `setTimeout` / `setInterval`
- `Promise.then` / `catch`
- `addEventListener` (all DOM events)
- `XMLHttpRequest` / `fetch`
- `requestAnimationFrame`

After each async operation completes, Zone.js notifies Angular, which then runs change detection on the **entire** component tree from root to leaves. This is the "default" Angular behavior — simple to use, but wasteful.

**Why remove it**:

| With Zone.js | Without Zone.js (Zoneless) |
|---|---|
| ~13KB gzipped added to bundle | 0KB — removed entirely |
| Every async op triggers full-tree CD | Only signal changes trigger targeted CD |
| Monkey-patching adds overhead to every `setTimeout`, `Promise`, event listener | Native APIs run at full speed |
| Hard to debug: "why did CD trigger?" | Explicit: CD triggers because a signal changed |
| Third-party libraries' async operations trigger CD | Only your code's signal writes trigger CD |

**How it works without Zone.js**:
1. `signal.set()` or `signal.update()` marks the signal as dirty
2. Angular's scheduler is notified (internally, via `markSignalDirty`)
3. Angular walks the component tree but only re-checks components that **read a dirty signal**
4. `computed()` signals propagate dirtiness to their dependents
5. `effect()` runs after all signals stabilize
6. Components that didn't read any dirty signal are skipped entirely

### 11.3 Signals + OnPush + Zoneless = Perfect Trio

These three features create a synergy that minimizes rendering work:

```
Signal changes
    │
    ├─ Marks specific components as dirty (not the whole tree)
    │
    ├─ OnPush prevents unnecessary re-checking of unchanged subtrees
    │
    └─ No Zone.js means no accidental full-tree CD from random async ops

Result: MINIMAL, PRECISE re-rendering
```

**Concrete example**: When `store.loading.set(false)` fires after an HTTP request:

1. Only components reading `store.loading()` in their template are marked dirty
2. `ExpenseCardComponent` components reading `store.expenses()` are NOT marked dirty (that signal didn't change yet)
3. When `store.expenses.set(newList)` fires next, only components reading `expenses()` are marked dirty
4. Angular batches both updates into one CD cycle
5. No `markForCheck()`, no `async` pipe, no manual subscription

```typescript
// Template — signal reads are automatic dependencies
@if (store.loading()) {
  <app-loading-spinner />        ← re-renders when loading() changes
} @else {
  @for (e of store.expenses(); track e.id) {
    <app-expense-card [expense]="e" />  ← re-renders when expenses() changes
  }
}
```

---

## 12. Error Handling

### 12.1 Three-Layer Error Strategy

```
┌───────────────────────────────────────────────────────────┐
│                 ERROR HANDLING LAYERS                       │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Layer 1: STORE-LEVEL (business errors)                   │
│  ─────────────────────────────────────                    │
│  Where: Store subscribe() error callbacks                 │
│  Catches: Expected errors (validation, 404, 409)          │
│  Response: Specific snack bar message, update error signal│
│                                                           │
│  Layer 2: INTERCEPTOR-LEVEL (auth errors)                 │
│  ─────────────────────────────────────                    │
│  Where: auth.interceptor.ts                               │
│  Catches: 401 Unauthorized                                │
│  Response: Token refresh → retry, or logout               │
│                                                           │
│  Layer 3: GLOBAL ERROR HANDLER (unhandled)                │
│  ─────────────────────────────────────                    │
│  Where: GlobalErrorHandler (replaces Angular default)     │
│  Catches: Everything that escapes Layer 1 and 2           │
│  Response: Generic snack bar, console.error               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Why three layers**: Defense in depth. Expected errors are handled specifically (Layer 1). Auth errors have special retry logic (Layer 2). Anything unexpected — runtime exceptions, template errors, third-party library crashes — is caught by the global handler (Layer 3) so the user always sees something rather than a white screen.

### 12.2 GlobalErrorHandler

```typescript
// frontend/src/app/core/error/error-handler.service.ts

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
          ? error.error.message.join(', ')  // ◄ class-validator arrays
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
```

**Design decisions**:

| Decision | Why |
|---|---|
| Implements Angular's `ErrorHandler` interface | Replaces the default handler that only calls `console.error`. We add user-facing feedback. |
| `extractMessage()` with three cases | Handles: (1) Backend errors with message (string or array from class-validator), (2) Backend errors without message (just status code), (3) JavaScript runtime errors, (4) Unknown errors (fallback string). |
| `NgZone.run()` | Even with zoneless, some Material components (like snackbar) need to be triggered inside the Angular zone for their animations and change detection to work correctly. This is a known edge case. |
| `panelClass: 'error-snackbar'` | CSS class that styles the snackbar red (defined in global `styles.scss`). Visually distinguishes errors from success messages (which use the default theme). |
| `console.error` before snackbar | Ensures the full error (with stack trace) is available in DevTools for debugging, even if the snackbar only shows a summary. |

### 12.3 Store-Level Error Handling

```typescript
// Pattern used in all stores (example from PersonalExpenseStore)
this.service.create(dto).subscribe({
  next: () => {
    this.snackBar.open('Expense created', '', { duration: 3000 });
    this.loading.set(false);
    this.loadExpenses(month, year);
    onSuccess?.();
  },
  error: err => {
    this.snackBar.open(
      err.error?.message ?? 'Failed to create', '', { duration: 4000 }
    );
    this.error.set(err.error?.message);
    this.loading.set(false);
  },
});
```

**Why handle errors in stores**: Stores catch errors from their service calls, display user-friendly messages via snackbar, update the `error` signal for UI display, and reset `loading`. This prevents expected errors (validation failures, 404s, permission denied) from bubbling up to the GlobalErrorHandler, which would show a less specific message.

**Error precedence**: If a store subscribes and handles the error, the GlobalErrorHandler never sees it. Only truly unhandled errors (component template errors, uncaught promises, etc.) reach Layer 3.

### 12.4 Interceptor Error Handling

The interceptor handles **only** 401 errors (covered in detail in [Section 5.3](#53-higher-order-observables)). All other HTTP errors (400, 403, 404, 500) pass through unchanged to the calling store's error handler.

```typescript
// From auth.interceptor.ts
catchError(error => {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return handle401(req, next, tokenService, authService);
  }
  return throwError(() => error);  // ◄ all non-401 errors pass through
});
```

---

## 13. Testing Strategy

### 13.1 Testing Pyramid

```
         ╱ ╲
        ╱ E2E╲           8 test suites (Playwright)
       ╱───────╲          Critical user flows end-to-end
      ╱         ╲         against real backend
     ╱───────────╲
    ╱    Unit     ╲       33 test files (Vitest)
   ╱───────────────╲      Services, stores, pipes,
  ╱                 ╲     directives, components
 ╱───────────────────╲
```

The pyramid is intentionally **bottom-heavy**: many unit tests (fast, cheap, isolated) and fewer E2E tests (slow, expensive, but validate real integration). There is no integration test layer because the unit tests mock at the service boundary and the E2E tests cover the full stack.

### 13.2 Unit Test Patterns

#### Store Tests

The most important unit tests — stores contain all state management logic:

```typescript
// frontend/src/app/features/personal-expenses/stores/personal-expense.store.spec.ts

describe('PersonalExpenseStore', () => {
  let store: PersonalExpenseStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    service = {
      list: vi.fn(), get: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    snackBar = { open: vi.fn() };
    const paymentService = {
      markPaid: vi.fn(), undoPaid: vi.fn(),
      cancel: vi.fn(),
      getStatus: vi.fn().mockReturnValue(of([])),
    };
    TestBed.configureTestingModule({
      providers: [
        PersonalExpenseStore,
        { provide: PersonalExpenseService, useValue: service },
        { provide: ExpensePaymentService, useValue: paymentService },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    store = TestBed.inject(PersonalExpenseStore);
  });

  const mockExpense = {
    id: 'e-1', name: 'Rent', amount: 1000, type: 'PERSONAL',
    category: 'RECURRING', frequency: 'MONTHLY',
    // ... remaining fields
  };

  it('loadExpenses sets expenses signal', () => {
    service['list'].mockReturnValue(of([mockExpense]));
    store.loadExpenses(3, 2025);
    expect(store.expenses()).toEqual([mockExpense]);   // ◄ read signal directly
    expect(store.loading()).toBe(false);                // ◄ verify loading reset
  });

  it('loadExpenses sets empty array on error', () => {
    service['list'].mockReturnValue(throwError(() => new Error()));
    store.loadExpenses();
    expect(store.expenses()).toEqual([]);               // ◄ graceful degradation
  });

  it('totalMonthly computed sums amounts', () => {
    const e2 = { ...mockExpense, id: 'e-2', amount: 500 };
    service['list'].mockReturnValue(of([mockExpense, e2]));
    store.loadExpenses();
    expect(store.totalMonthly()).toBe(1500);            // ◄ test computed signal
  });

  it('createExpense reloads expenses on success', () => {
    service['create'].mockReturnValue(of(mockExpense));
    service['list'].mockReturnValue(of([mockExpense]));
    store.createExpense({ name: 'Rent', amount: 1000 }, 3, 2025);
    expect(service['list']).toHaveBeenCalledWith(3, 2025);  // ◄ verify side effect
  });

  it('sets error on createExpense failure', () => {
    service['create'].mockReturnValue(
      throwError(() => ({ error: { message: 'fail' } }))
    );
    store.createExpense({ name: 'X', amount: 1 });
    expect(store.error()).toBe('fail');                 // ◄ verify error signal
  });
});
```

**Key patterns in store tests**:
- Mock all dependencies with `vi.fn()` (Vitest's mock function, equivalent to Jest's `jest.fn()`)
- Use `TestBed.configureTestingModule()` to create the store with mocked providers
- Test **signal state transitions**: `loading` true → false, `expenses` populated or empty
- Test **computed signals** react to state changes: `totalMonthly` recalculates when expenses change
- Test **error paths**: service returns `throwError()`, verify `error` signal and snackbar
- Test **side effects**: verify that `service.list` is called after `createExpense` succeeds (list refresh)

#### Service Tests

```typescript
// Pattern: mock ApiService, verify correct URL and params
describe('PersonalExpenseService', () => {
  let service: PersonalExpenseService;
  let api: { get: ReturnType<typeof vi.fn>; post: ...; put: ...; delete: ... };

  beforeEach(() => {
    api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PersonalExpenseService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(PersonalExpenseService);
  });

  it('list calls GET /expenses/personal with month/year params', () => {
    api.get.mockReturnValue(of([]));
    service.list(3, 2025);
    expect(api.get).toHaveBeenCalledWith(
      '/expenses/personal',
      expect.any(HttpParams),
    );
  });
});
```

**What's tested**: Correct URL construction, correct HTTP method, correct query params. Services are thin wrappers so the tests are straightforward.

#### Pipe Tests

```typescript
// Pure function testing — input → expected output
describe('CurrencyEurPipe', () => {
  const pipe = new CurrencyEurPipe();

  it('formats positive amount', () => {
    expect(pipe.transform(1234.5)).toBe('1.234,50 €');
  });

  it('formats zero', () => {
    expect(pipe.transform(0)).toBe('0,00 €');
  });

  it('handles null', () => {
    expect(pipe.transform(null)).toBe('0,00 €');
  });
});
```

#### Directive Tests

```typescript
// Set up a test host component, verify DOM behavior
@Component({ template: `<input appPositiveNumber>` })
class TestHost {}

describe('PositiveNumberDirective', () => {
  it('blocks negative sign keypress', () => {
    // ... create component, dispatch keypress event, verify it was prevented
  });
});
```

#### Component Tests

```typescript
// Presentational components: set inputs, verify output
describe('ApprovalCardComponent', () => {
  it('emits accept event when accept button clicked', () => {
    const fixture = TestBed.createComponent(ApprovalCardComponent);
    const spy = vi.fn();
    fixture.componentRef.setInput('approval', mockApproval);
    fixture.componentInstance.accept.subscribe(spy);

    // click the accept button...
    expect(spy).toHaveBeenCalledWith(mockApproval.id);
  });
});
```

### 13.3 AAA Pattern (Arrange-Act-Assert)

Every test follows the same three-phase structure:

```typescript
it('should [expected behavior] when [condition]', () => {
  // ── ARRANGE: set up mocks, prepare input data ─────────────
  service['list'].mockReturnValue(of([mockExpense]));

  // ── ACT: call the method or trigger the action ────────────
  store.loadExpenses(3, 2025);

  // ── ASSERT: check signals, mock calls, DOM state ──────────
  expect(store.expenses()).toEqual([mockExpense]);
  expect(store.loading()).toBe(false);
});
```

**Why AAA**: Consistent structure makes tests scannable. A reviewer can quickly find what's being set up, what's being tested, and what's expected. When a test fails, you immediately know which phase broke.

### 13.4 What We Test and What We Skip

| Category | Test? | Why |
|---|---|---|
| **All stores** (7) | Yes | Core business logic — state transitions, error handling, side effects |
| **All services** (10+) | Yes | Verify correct URL construction and HTTP method dispatch |
| **All pipes** (3) | Yes | Pure functions with edge cases (null, zero, negative) |
| **Directives with logic** (2) | Yes | DOM manipulation that can break silently |
| **Components with logic** (forms, cards) | Yes | Input/output contracts, computed display logic |
| **Core services** (auth, token, error handler, API) | Yes | Critical infrastructure — bugs here affect everything |
| Pure template components (just HTML bindings) | No | No logic to test — bindings are covered by TypeScript compiler |
| Route configuration | No | Declarative — tested implicitly by E2E navigation tests |
| Module/component imports | No | Compiler catches missing imports at build time |

**Total**: 33 unit test files covering the full frontend logic surface.

### 13.5 E2E Testing (Playwright)

#### Suite Overview

| Test File | What It Covers | Key Flows |
|---|---|---|
| `auth.spec.ts` | Authentication flows | Login with valid/invalid credentials, validation errors, route protection redirect, auth guard behavior |
| `personal-expenses.spec.ts` | Personal expense CRUD | Create recurring/one-time expense, edit, delete with confirmation, payment status toggle |
| `shared-expenses.spec.ts` | Shared expense proposal flow | Propose create → requires approval, edit proposal, delete proposal |
| `approvals.spec.ts` | Approval workflow | View pending approvals, accept, reject with reason, cancel own approval, approval history |
| `dashboard.spec.ts` | Financial overview | Income/expense summary cards, savings display, settlement calculation |
| `savings.spec.ts` | Savings management | Personal/shared savings add, withdrawal (personal immediate, shared via approval), savings display |
| `salary.spec.ts` | Salary management | Salary upsert, household salary view, monthly salary tracking |
| `timeline-navigation.spec.ts` | Month navigation | Navigate between months, recurring override creation, timeline display |

#### Global Setup

```typescript
// e2e/global-setup.ts
export default async function globalSetup() {
  await cleanupAllTestData();
}
```

Before all tests run, the global setup:
1. Connects to Redis and clears stale throttle/block keys from previous runs
2. Connects to PostgreSQL and removes leftover E2E test data (expenses, approvals, savings)
3. Ensures test users exist with known credentials

This guarantees a **clean slate** for every test run — tests are not affected by state left from previous runs.

#### E2E Test Patterns

```typescript
// e2e/tests/auth.spec.ts (excerpt)

test.describe('Authentication', () => {
  test('should redirect to main app after login', async ({ page }) => {
    await page.goto('/auth/login');

    // Verify we are on the login page
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Fill in credentials
    await page.getByLabel('Email').fill(TEST_USERS.alex.email);
    await page.getByLabel('Password').fill(TEST_USERS.alex.password);

    // Submit
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify navigation
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page).toHaveURL(/\/household/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(TEST_USERS.alex.email);
    await page.getByLabel('Password').fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Verify snackbar error
    const snackbar = page.locator('mat-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.removeItem('sb_refresh_token'));
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

**E2E design decisions**:

| Decision | Why |
|---|---|
| **Real backend** (not mocked) | E2E tests validate the full integration: Angular → HTTP → NestJS → PostgreSQL → Redis. Mocking the backend would defeat the purpose. |
| **Semantic selectors** (`getByLabel`, `getByRole`, `getByText`) | More resilient than CSS selectors. If a CSS class changes, tests don't break. Follows Playwright's testing best practices. |
| **`TEST_USERS` fixture** | Pre-seeded test accounts with known credentials. Tests don't create users on the fly — registration is tested separately. |
| **Parallel execution** | Playwright runs test files in parallel by default, using separate browser contexts. Tests are isolated and don't interfere with each other. |
| **`data-testid` for complex selectors** | When semantic selectors aren't sufficient (e.g., selecting one of many cards), `data-testid` attributes provide stable hooks. |

---

## 14. Design Principles

### 14.1 Principles Applied

Each principle is demonstrated with a concrete example from the codebase:

| Principle | Where Applied | Concrete Example |
|---|---|---|
| **Single Responsibility (SRP)** | Every class/function has one job | `ApiService` only handles HTTP dispatch. `TokenService` only manages tokens. Stores only manage state. Services only call APIs. `GlobalErrorHandler` only catches unhandled errors. |
| **DRY (Don't Repeat Yourself)** | Shared building blocks reused across features | `CurrencyEurPipe` used in 9 features. `PageHeaderComponent` used by every page. `ApiService` prevents duplicating `HttpClient` setup. `ConfirmDialogComponent` reused for all delete confirmations. |
| **KISS (Keep It Simple, Stupid)** | Simplest solution that works | Custom signal stores instead of NgRx (no action/reducer/effect ceremony). Functional guards/interceptors instead of class-based. Thin services instead of complex repository patterns. |
| **Composition Over Inheritance** | No component inheritance anywhere | Shared behavior via directives (`AutoFocusDirective`) and pipes (`CurrencyEurPipe`), not base classes. Store pattern via convention, not a `BaseStore` abstract class. |
| **Separation of Concerns** | Each layer does one thing | Template (HTML) / Style (CSS) / Logic (TS) per component. Core / Shared / Features layer separation. Container vs Presentational split. Interceptor handles auth, not services. |
| **Dependency Inversion** | High-level modules don't depend on low-level details | Components depend on store signals (abstraction), not HTTP details. Stores depend on service methods, not `HttpClient` directly. Services depend on `ApiService`, not URL construction. |
| **Unidirectional Data Flow** | Data flows one way | Store → Page → Component (via inputs). Events flow back: Component → Page → Store. No two-way binding to store state. No component mutating store signals directly. |
| **Fail Fast** | Detect and surface errors immediately | Auth guard checks tokens immediately on navigation. `GlobalErrorHandler` catches all unhandled errors. Stores reset `loading` on error (no infinite spinners). |
| **Convention Over Configuration** | Consistent patterns reduce decisions | All features follow identical folder structure. All stores follow identical signal pattern. All services follow identical `ApiService` wrapper pattern. A developer knows where to look without asking. |

### 14.2 Design Patterns Used

| Pattern | Where | Purpose |
|---|---|---|
| **Container/Presentational** | Pages vs Components | Separation of orchestration (data fetching, routing) from rendering (inputs/outputs) |
| **Observer** | Signals, Observables | Reactive state propagation without manual subscription management |
| **Facade** | Signal Stores | Stores are facades over services — components interact with a simple signal-based API instead of raw HTTP calls |
| **Singleton** | `providedIn: 'root'` services | One instance per service across the app, shared state |
| **Strategy** | Auth Interceptor | The interceptor decides at runtime whether to add a token, refresh, or pass through — different strategy per request context |
| **Bridge** | `toSignal()` | Bridges the Observable world (CDK, HttpClient) to the Signal world (templates, change detection) |
| **Template Method** | Store action methods | All action methods follow the same steps: set loading → call service → handle success/error → update signals |
| **Proxy** | `ApiService` | Wraps `HttpClient` with URL construction, acts as a proxy for all HTTP requests |

### 14.3 Architecture Decision Records (ADR) Summary

| Decision | Chosen | Alternatives Considered | Rationale |
|---|---|---|---|
| State management | Custom signal stores | NgRx, NgRx SignalStore, Akita, Elf, TanStack Query | Simpler, 0KB extra, sufficient for 7 stores. NgRx justified only at 20+ features with cross-feature state. |
| Change detection | Zoneless + OnPush | Zone.js default | -13KB bundle, faster async, signals make Zone.js unnecessary |
| Component style | Standalone | NgModules | Less boilerplate, better tree-shaking, Angular's recommended approach since v15 |
| HTTP layer | Centralized `ApiService` | Direct `HttpClient` injection per service | Single point of change for base URL, consistent URL handling |
| Auth tokens | Memory + localStorage | httpOnly cookies, sessionStorage | XSS mitigation for access token (in-memory), persistence for refresh (localStorage) |
| CSS approach | CSS variables + M3 theme | Tailwind, SCSS-only custom design | Consistent with Material Design, dynamic theming via class toggle, no utility class bloat |
| Testing framework | Vitest | Jest, Karma | 2-5x faster, ESM-native, modern. Karma is deprecated by Angular team. |
| E2E framework | Playwright | Cypress, WebDriverIO | Cross-browser, reliable auto-waiting, parallel execution, trace viewer |
| Date library | date-fns | moment.js, luxon, dayjs | Tree-shakable (~6KB vs moment's 72KB), immutable API, modern |
| Charts | chart.js | D3, Recharts, Nivo | Lightweight (~60KB), simple API for bar/line charts. D3 overkill for 3 chart types. |

---

## 15. Appendix

### 15.1 File Count Summary

| Category | Count |
|---|---|
| Feature areas | 9 |
| Page components | 19 |
| Feature components | 28 |
| Shared components | 7 |
| Signal stores | 7 |
| API services | 10+ |
| Pipes | 3 |
| Directives | 2 |
| Validators | 1 |
| Unit test files | 33 |
| E2E test suites | 8 |

### 15.2 Key File Paths Reference

All paths relative to `frontend/src/app/`:

| File | Purpose |
|---|---|
| `app.config.ts` | Bootstrap configuration (providers, initializers) |
| `app.routes.ts` | Top-level routing (lazy-loaded features) |
| `app.ts` | Root component (minimal — just `<router-outlet>`) |
| `core/api/api.service.ts` | Centralized HTTP wrapper |
| `core/auth/auth.service.ts` | Auth state management (signals + HTTP) |
| `core/auth/token.service.ts` | Token storage (in-memory + localStorage) |
| `core/auth/auth.interceptor.ts` | Token injection + 401 refresh queue |
| `core/auth/auth.guard.ts` | Route protection |
| `core/error/error-handler.service.ts` | Global error handler |
| `core/layout/shell.component.ts` | Responsive app shell (toolbar + sidenav) |
| `core/theme/theme.service.ts` | Dark/light/system theme toggle |
| `shared/models/index.ts` | Model barrel export (all TypeScript interfaces) |
| `shared/components/` | 7 reusable presentational components |
| `shared/pipes/` | 3 pure pipes (currency, monthly equivalent, relative time) |
| `features/*/stores/*.store.ts` | 7 signal stores (one per feature) |
| `features/*/services/*.service.ts` | Feature API services |
| `features/*/pages/*.component.ts` | Container/page components |
| `features/*/components/*.component.ts` | Presentational/dumb components |

### 15.3 Interview Quick-Reference Cards

#### Card 1: "Tell me about your state management approach"

> We use **custom signal stores** — one per feature, using Angular's built-in `signal()`, `computed()`, and `effect()` primitives. Each store is an `@Injectable({ providedIn: 'root' })` service with state signals, computed derived values, and action methods that call API services and update state. We chose this over NgRx because with only 7 stores and mostly independent feature state, NgRx's action/reducer/effect/selector ceremony adds boilerplate without proportional benefit. The tradeoff: we lose time-travel debugging and action logging, but gain simplicity, zero extra bundle size, and faster development velocity. If the app grew to 30+ features with complex cross-feature workflows, we'd consider migrating to NgRx or NgRx SignalStore.
>
> **See**: [Section 4 — Signal Store Pattern](#4-signal-store-pattern-custom-state-management)

#### Card 2: "How do you handle authentication?"

> **Token strategy**: Access token in-memory (not accessible via XSS), refresh token in localStorage (survives page refresh). On page reload, `provideAppInitializer` silently refreshes the session before the app renders. The **auth interceptor** adds Bearer tokens to requests and implements a **token refresh queue** using `BehaviorSubject` + `filter` + `take(1)` — when multiple requests fail with 401 simultaneously, only one refresh request fires, and all queued requests retry with the new token. The **auth guard** is a functional `CanActivateFn` applied on the shell route, protecting all authenticated pages with a single declaration.
>
> **See**: [Section 6 — Auth Architecture](#6-auth-architecture)

#### Card 3: "What is your change detection strategy?"

> **OnPush + Zoneless + Signals** — the trifecta. Every component uses `ChangeDetectionStrategy.OnPush`. We removed Zone.js entirely (`provideZonelessChangeDetection()`), saving ~13KB and eliminating monkey-patching overhead. Change detection is driven exclusively by signals — when a signal changes, only components that read that signal are re-rendered. No `markForCheck()`, no `async` pipe, no manual subscription management. This gives us minimal, precise re-rendering with zero unnecessary work.
>
> **See**: [Section 11 — Change Detection Strategy](#11-change-detection-strategy)

#### Card 4: "How do you organize your code?"

> **Feature-Sliced Design** with three layers: `core/` (singletons — auth, API, layout, theme, error handler), `shared/` (reusable components, pipes, directives, models — zero business logic), and `features/` (9 lazy-loaded domains). Dependencies flow one direction: features → shared → core. Within each feature, we follow the **Container/Presentational** pattern: pages (containers) inject stores and handle routing, while components (presentational) receive data via `input()` and emit events via `output()`. Every feature has the same folder structure: `pages/`, `components/`, `services/`, `stores/`, `routes.ts`.
>
> **See**: [Section 2 — Feature-Sliced Design](#2-architecture-pattern--feature-sliced-design), [Section 3 — Container/Presentational](#3-containerpresentational-pattern-smartdumb)

#### Card 5: "How do you handle errors?"

> **Three layers**: (1) **Store-level** catches expected business errors (validation, 404) and shows specific snackbar messages. (2) **Interceptor-level** catches 401 Unauthorized and either refreshes the token or logs out. (3) **GlobalErrorHandler** catches everything that escapes layers 1 and 2 — unhandled runtime exceptions, template errors, third-party crashes — and shows a generic error snackbar while logging the full error to console. Defense in depth: the user always sees feedback, and developers always have debug info.
>
> **See**: [Section 12 — Error Handling](#12-error-handling)

#### Card 6: "What design patterns do you use?"

> **Container/Presentational** (pages orchestrate, components render), **Observer** (signals for reactive state propagation), **Facade** (stores simplify service interactions for components), **Singleton** (`providedIn: 'root'` for all services and stores), **Strategy** (interceptor applies different auth handling per request context), **Bridge** (`toSignal()` converts Observables to signals), **Proxy** (`ApiService` wraps `HttpClient`). We follow **SRP**, **DRY**, **KISS**, **Composition over Inheritance**, **Unidirectional Data Flow**, and **Convention over Configuration** throughout.
>
> **See**: [Section 14 — Design Principles](#14-design-principles)

---

*Document generated from the SharedBudget codebase. All code examples are from actual source files, not pseudocode.*
