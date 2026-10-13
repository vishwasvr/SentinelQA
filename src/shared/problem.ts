/** RFC 9457 problem error thrown by shared modules; handlers map it to application/problem+json. */
export class ProblemError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'ProblemError';
  }
}
