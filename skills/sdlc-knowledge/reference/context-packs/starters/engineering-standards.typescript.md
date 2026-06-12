# Engineering Standards — TypeScript Starter

> A filled starter for Context Pack 02. Copy this into `../02-engineering-standards.md`
> and adjust. The shared principles in `../02-engineering-standards.md` still apply.

## Languages & frameworks
- TypeScript in `strict` mode; target the current Node.js LTS.
- No `any` — use `unknown` at boundaries and narrow; prefer discriminated unions.

## Naming & formatting
- `camelCase` for variables and functions, `PascalCase` for types and classes,
  `UPPER_SNAKE_CASE` for module constants.
- Prettier for formatting; ESLint (typescript-eslint) for linting. Both run in CI.
- **Biome 2 alternative:** If using Biome instead of Prettier+ESLint, set
  `"formatter": { "enabled": true }` and `"linter": { "enabled": true }` in
  `biome.json`. For NestJS projects, disable `useImportType` (keeps DI metadata
  intact) and enable `unsafeParameterDecoratorsEnabled: true`.

## Error handling
- Throw typed `Error` subclasses or return an explicit `Result`-style union — never
  throw bare strings, never swallow.
- No floating promises; every async call is awaited or explicitly handled.

## Logging
- Structured JSON logs (e.g. pino). Include a correlation ID. Never log secrets or PII.

## API conventions
- Validate every external input at the boundary with a schema (e.g. Zod).
- Keep public response shapes backward-compatible; version breaking changes.

## NestJS-specific patterns

### DTO validation — whitespace strings
`@IsNotEmpty()` does not reject whitespace-only strings (`'   '` passes). Always pair
with `@Transform` when trimming is semantically required:

```typescript
@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
@IsNotEmpty({ message: 'Field cannot be empty' })
text!: string;
```

### Biome 2 + NestJS decorator compatibility
NestJS DI relies on `emitDecoratorMetadata`. Biome's `useImportType` rule converts
injected service imports to `import type`, which strips the runtime metadata and breaks
DI. Always disable it for NestJS projects in `biome.json`:

```json
{
  "linter": {
    "rules": {
      "correctness": { "useImportType": "off" }
    }
  },
  "javascript": {
    "parser": { "unsafeParameterDecoratorsEnabled": true }
  }
}
```

### Global prefix and k8s health probes
When using `app.setGlobalPrefix('api')`, **every** route (including health) is
prefixed. k8s readiness and liveness probes must use `/api/health`, not `/health`.
Author k8s manifests alongside the module they probe:

```yaml
readinessProbe:
  httpGet:
    path: /api/health   # matches setGlobalPrefix('api')
    port: 3000
```

### TypeORM integration test teardown
`app.close()` destroys the TypeORM DataSource. Do not call `dataSource.destroy()` in
`afterAll` after `app.close()` — it will throw `CannotExecuteNotConnectedError`. The
correct pattern:

```typescript
afterAll(async () => {
  await app.close();        // destroys DataSource internally
  await container.stop();   // stop Testcontainers Postgres
});
```

### Playwright e2e against NestJS + k8s

> Added: todo-e2e-k8s-playwright run, 2026-05-24.

When writing Playwright tests against a NestJS backend deployed via Skaffold on Docker Desktop k8s, use these defaults in `playwright.config.ts`:

```typescript
export default defineConfig({
  timeout: 60_000,          // k8s cold-start can take 30–45s on first run
  expect: { timeout: 10_000 }, // k8s adds latency; 5s default is too tight
  fullyParallel: false,     // shared seeded DB user: sequential avoids afterEach/beforeEach race
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 15_000,  // per-action wait; explicit is safer than inheriting timeout
    trace: 'on-first-retry',
  },
});
```

**Health-check polling:** Because the backend uses `setGlobalPrefix('api')`, the health endpoint is `/api/health`. Validate the body — HTTP 200 does not mean the DB is up:

```typescript
test.beforeEach(async ({ page }) => {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await page.request.get('http://localhost:3000/api/health');
      if (r.ok()) {
        const body = await r.json();
        if (body.status === 'ok') break;
      }
    } catch { /* not ready yet */ }
    await page.waitForTimeout(1_000);
  }
  await page.goto('/login');
});
```

**JWT for API cleanup:** Obtain an auth token once in `beforeAll` and use it in `afterEach` to clean up test data via the API — do not rely on the browser session for cleanup calls.

### Tailwind v4 + Vite
Tailwind v4 does **not** use a PostCSS config for the Vite build path. Use the Vite
plugin instead (and add it as a direct dep):

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
});
```

```bash
pnpm add tailwindcss @tailwindcss/vite daisyui
```

CSS entry point: `@import "tailwindcss";` (no `@tailwind base/components/utilities`).

## Testing
- Vitest or Jest; test files co-located as `*.test.ts`.
- Arrange–Act–Assert; test behavior, not implementation; deterministic, no real network.
- For NestJS integration tests with Testcontainers: use a real Postgres container per
  test suite; scope teardown to `app.close()` only (see NestJS teardown pattern above).

## Dependencies
- Pin versions via a lockfile. Prefer the standard library and small, well-maintained
  packages. New dependencies require escalation.

## Pull requests
- Small and focused. The description states what changed, why, risks, and test evidence.
