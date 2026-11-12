import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ActorService } from './actor.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Adds the self-declared X-Actor header to every write request. */
export const actorInterceptor: HttpInterceptorFn = (req, next) => {
  const actor = inject(ActorService).actor();
  if (actor && WRITE_METHODS.has(req.method)) {
    return next(req.clone({ setHeaders: { 'X-Actor': actor } }));
  }
  return next(req);
};
