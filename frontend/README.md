# SharedBudget frontend

The frontend is an Angular 21 single-page application for household finance management. It uses standalone components, lazy-loaded feature routes, Angular signals, zoneless change detection, Angular Material 3, and Chart.js.

The production application is available at [sharedbudget.vercel.app](https://sharedbudget.vercel.app). Visitors can use the **Open live demo** button on the login page without entering credentials or creating an account.

## Main areas

- `src/app/core/` — authentication, API access, global error handling, and the application shell
- `src/app/shared/` — models, reusable components, pipes, validators, directives, and utilities
- `src/app/features/` — auth, household, dashboard, expenses, income, savings, decisions, and settings
- `src/styles/` — design tokens and shared theme variables

## API integration

Application services call `/api/v1`. Local development uses the Angular proxy configuration to reach the backend on port `3000`; Vercel rewrites `/api/*` to the Railway backend.

Authentication uses an in-memory access token and a refresh token managed by the backend. `AuthService`, the auth interceptor, and route guards own the browser session flow.

## Commands

Run these from `frontend/`:

```bash
npm install
npm start                 # http://localhost:4200
npm test                  # 43 Vitest spec files, 323 tests
npm run test:cov
npm run build             # production output in dist/frontend/browser
```

The backend must be available for real login and data requests. See the [root setup guide](../README.md#run-locally) for the complete local stack.

## Production

Vercel builds the Angular production bundle and serves the SPA with route fallback, immutable asset caching, API proxying, and security headers configured in `vercel.json`.

The one-click public demo deliberately uses the normal `AuthService.login()` path. It verifies the same API, token, current-user, and navigation behavior as a manual login.

## Verification

Frontend changes should pass:

```bash
npm test
npm run build
```

Browser workflows live in [`../e2e/`](../e2e/) and run in GitHub Actions after both production builds succeed.
