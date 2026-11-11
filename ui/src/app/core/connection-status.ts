import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { ApiError } from '../api/api-error';

export type ConnectionProblem =
  | { kind: 'offline'; message: string }
  | { kind: 'unreachable'; message: string }
  | { kind: 'server-error'; message: string };

export const OFFLINE_MESSAGE =
  'You are offline. Check your network connection; nothing can be loaded or saved until you are back online.';
export const UNREACHABLE_MESSAGE =
  'Cannot reach the API. Check that it is running and that you are connected, then retry.';

type Failure = { kind: 'unreachable' } | { kind: 'server-error'; status: number };

/**
 * What the app knows about its connection: the browser's online flag plus what the last API calls said.
 * The error interceptor reports into it; the banner in the shell reads it; pages watch `retryTick` to reload.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionStatus {
  private readonly win = inject(DOCUMENT).defaultView;
  private readonly online = signal(this.win?.navigator.onLine ?? true);
  private readonly failure = signal<Failure | null>(null);

  /** Counts retry requests (the banner's Retry button and the browser coming back online). */
  readonly retryTick = signal(0);

  /** The problem to show, offline first; null while everything works. */
  readonly problem = computed<ConnectionProblem | null>(() => {
    if (!this.online()) {
      return { kind: 'offline', message: OFFLINE_MESSAGE };
    }
    const failure = this.failure();
    if (failure?.kind === 'unreachable') {
      return { kind: 'unreachable', message: UNREACHABLE_MESSAGE };
    }
    if (failure?.kind === 'server-error') {
      return {
        kind: 'server-error',
        message: `The API reported a problem (HTTP ${failure.status}). Some data may be out of date.`,
      };
    }
    return null;
  });

  constructor() {
    const win = this.win;
    if (!win) {
      return;
    }
    const goOnline = () => {
      this.online.set(true);
      this.failure.set(null);
      this.retryTick.update((n) => n + 1);
    };
    const goOffline = () => this.online.set(false);
    win.addEventListener('online', goOnline);
    win.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline);
      win.removeEventListener('offline', goOffline);
    });
  }

  /** A response arrived (any status below 500), so the API is reachable and healthy. */
  reportSuccess(): void {
    this.failure.set(null);
  }

  reportFailure(error: ApiError): void {
    if (error.status === 0) {
      this.failure.set({ kind: 'unreachable' });
    } else if (error.status >= 500) {
      this.failure.set({ kind: 'server-error', status: error.status });
    } else {
      this.failure.set(null);
    }
  }

  /** Clears the message and asks the pages to load again. */
  retry(): void {
    this.failure.set(null);
    this.retryTick.update((n) => n + 1);
  }

  dismiss(): void {
    this.failure.set(null);
  }
}
