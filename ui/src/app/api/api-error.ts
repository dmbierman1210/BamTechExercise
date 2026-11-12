import { HttpErrorResponse } from '@angular/common/http';
import type { FieldError } from './models';

export const API_UNREACHABLE_MESSAGE =
  'API unreachable. Check that the API (or the mock: npm run start:mock) is running, then try again.';

/** Typed error produced by the error interceptor from the API's error envelope. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status code; 0 when the API could not be reached. */
    readonly status: number,
    message: string,
    readonly errors: readonly FieldError[] = [],
  ) {
    super(message);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** The first message for a field, e.g. `reason` or `X-Actor`. */
  fieldMessage(field: string): string | undefined {
    return this.errors.find((e) => e.field.toLowerCase() === field.toLowerCase())?.message;
  }

  static fromHttpError(error: HttpErrorResponse): ApiError {
    if (error.status === 0) {
      return new ApiError(0, API_UNREACHABLE_MESSAGE);
    }
    const body: unknown = error.error;
    if (isEnvelope(body)) {
      return new ApiError(error.status, body.message, readFieldErrors(body));
    }
    return new ApiError(error.status, `The API returned an unexpected response (${error.status}).`);
  }
}

interface Envelope {
  message: string;
  errors?: unknown;
}

function isEnvelope(body: unknown): body is Envelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Envelope).message === 'string' &&
    'success' in body
  );
}

function readFieldErrors(body: Envelope): FieldError[] {
  if (!Array.isArray(body.errors)) {
    return [];
  }
  return body.errors
    .filter(
      (e): e is FieldError =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as FieldError).field === 'string' &&
        typeof (e as FieldError).message === 'string',
    )
    .map((e) => ({ field: e.field, message: e.message }));
}
