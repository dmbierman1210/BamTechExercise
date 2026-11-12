import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { ConnectionStatus } from '../core/connection-status';
import { ApiError } from './api-error';

/**
 * Maps every failed HTTP call to a typed {@link ApiError} and tells {@link ConnectionStatus} whether the API
 * answered (so the global banner can show "offline" / "API down" and clear itself).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const connection = inject(ConnectionStatus);
  return next(req).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        connection.reportSuccess();
      }
    }),
    catchError((error: unknown) => {
      const mapped = error instanceof HttpErrorResponse ? ApiError.fromHttpError(error) : error;
      if (mapped instanceof ApiError) {
        connection.reportFailure(mapped);
      }
      return throwError(() => mapped);
    }),
  );
};
