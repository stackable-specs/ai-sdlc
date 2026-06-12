# Engineering Standards — Python Starter

> A filled starter for Context Pack 02. Copy this into `../02-engineering-standards.md`
> and adjust. The shared principles in `../02-engineering-standards.md` still apply.

## Languages & frameworks
- Python 3.11+. Type hints required on all public functions; `mypy` in strict mode.

## Naming & formatting
- `snake_case` for functions and variables, `PascalCase` for classes,
  `UPPER_SNAKE_CASE` for constants.
- Ruff for linting and formatting. Runs in CI.

## Error handling
- Raise specific exceptions from a small custom hierarchy. Never use a bare `except:`.
  Never silence an exception without a logged reason.

## Logging
- The `logging` module with structured `extra` fields; a correlation ID where flows
  cross boundaries. Never log secrets or PII.

## API conventions
- FastAPI for HTTP services; Pydantic models validate every external input.
- Keep public response shapes backward-compatible; version breaking changes.

## Testing
- `pytest`; the `tests/` tree mirrors the package. Use fixtures, not global state.
- Arrange–Act–Assert; test behavior; deterministic, no real network.

## Dependencies
- Declared in `pyproject.toml` and pinned via a lockfile. Use a managed virtual
  environment (e.g. uv or venv). New dependencies require escalation.

## Pull requests
- Small and focused. The description states what changed, why, risks, and test evidence.
