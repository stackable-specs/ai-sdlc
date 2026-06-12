# Engineering Standards — Go Starter

> A filled starter for Context Pack 02. Copy this into `../02-engineering-standards.md`
> and adjust. The shared principles in `../02-engineering-standards.md` still apply.

## Languages & frameworks
- Current stable Go. Keep packages small and cohesive; accept interfaces, return structs.

## Naming & formatting
- `MixedCaps`; exported identifiers `PascalCase`, unexported `camelCase`; short receiver
  names.
- `gofmt` / `goimports` enforced; `golangci-lint` in CI.

## Error handling
- Check every `error` explicitly. Wrap with context: `fmt.Errorf("doing X: %w", err)`.
- Do not `panic` in library code. Never discard an error silently.

## Logging
- `log/slog` for structured logs; a correlation ID across service calls. Never log
  secrets or PII.

## API conventions
- `net/http` (with a router such as chi); validate every external input at the boundary.
- Keep public response shapes backward-compatible; version breaking changes.

## Testing
- The standard `testing` package; table-driven tests in `_test.go` files.
- Deterministic; use `context.Context` for cancellation; no goroutine leaks.

## Dependencies
- Go modules; keep the dependency set minimal. New dependencies require escalation.

## Pull requests
- Small and focused. The description states what changed, why, risks, and test evidence.
