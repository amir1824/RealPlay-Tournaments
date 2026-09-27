/**
 * A dependency (Redis, Postgres, …) could not be reached. The HTTP layer
 * answers 503 and logs it as infrastructure, not as a bug; see
 * libs/platform/src/http/error-rules.ts.
 */
export class DependencyUnavailableError extends Error {
  constructor(
    readonly dependency: string,
    readonly cause: unknown,
  ) {
    super(`${dependency} unavailable`);
    this.name = 'DependencyUnavailableError';
  }
}
