# Ports declare their errors, adapters convert their own failures, and composition catches the rest

Expected failures are values, not exceptions. Domain operations, commands, queries and every port return `Result<T, E>`, a plain object, and the error is a serializable discriminated union keyed by `kind` (`validation`, `forbidden`, `not-found`, `rule` from the domain; `unauthenticated`, `conflict`, `infrastructure`, `unexpected` from the application). Each port declares in its signature the errors it can return, including `{ kind: 'infrastructure', port, code }` with a closed code list per port. Each adapter catches its own failures and converts them into that list, mapping anything it doesn't recognize to `code: 'unknown'` and attaching the raw exception as `cause`. A tracing wrapper in `src/composition/` around every command and query is the one remaining `catch`. It records `cause` and any thrown exception on the OpenTelemetry span, strips them, and turns a throw into `{ kind: 'unexpected', reference }`. We chose this so that everything reaching the application layer, and through it `app/`, is a known quantity that the code has to handle exhaustively, while stacks and internals stay on the server in telemetry.

## Considered Options

- **Let infrastructure failures throw raw to Next's error boundary.** This needs nothing built, but a failed Server Action replaces the page instead of showing a message in its form, and `app/` would have two unrelated failure paths.
- **One thrown `InfrastructureError` class.** Thrown errors would get a recognizable shape, but they would still bypass the `Result` that callers handle, and bugs would still throw raw.
- **Only a catch-all in composition.** This gives one shape at the edge, but the ports' contracts would say nothing about how they fail, so the application couldn't reason about, or test, specific infrastructure failures.

## Consequences

- Every port signature is `Promise<Result<T, PortError>>`, and commands pass errors up with plain early returns (`if (!r.ok) return r`). This is verbose on purpose.
- Mock adapters declare the same error unions as their real twins.
- Expected failures are recorded as span attributes (`app.error.kind`, `app.error.code`) with the span status left unset. Only `unexpected` sets the status to `ERROR`. The application and domain layers never import OpenTelemetry.
- Error data is limited to codes, field names and ids, never user input, so it is safe to copy into spans and logs.
- In pages, `app/` throws on purpose for `infrastructure` and `unexpected`, to reach `error.tsx` and `onRequestError`. A command's errors never reach the error boundary.
