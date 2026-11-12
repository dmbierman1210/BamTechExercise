import { HttpErrorResponse } from '@angular/common/http';
import type { FieldError } from './models';

export const API_UNREACHABLE_MESSAGE =
  'API unreachable. Check that the API is running and that it allows this app’s origin (CORS), then try again.';

/** Typed error produced by the error interceptor from the API's error envelope. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status code; 0 when the API could not be reached. */
    readonly status: number,
    message: string,
    readonly errors: readonly FieldError[] = [],
    /** Id of a failed request (500 only); it finds the exception in the API's process log. */
    readonly traceId?: string,
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
      const traceId = error.status >= 500 ? readTraceId(body) : undefined;
      const message = traceId ? `${body.message} (reference ${traceId})` : body.message;
      return new ApiError(error.status, message, readFieldErrors(body), traceId);
    }
    return new ApiError(error.status, `The API returned an unexpected response (${error.status}).`);
  }
}

interface Envelope {
  message: string;
  errors?: unknown;
  traceId?: unknown;
}

function readTraceId(body: Envelope): string | undefined {
  return typeof body.traceId === 'string' && body.traceId.length > 0 ? body.traceId : undefined;
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
