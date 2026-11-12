import { Injectable, signal } from '@angular/core';
import type { Params } from '@angular/router';

/**
 * Remembers the People list's query params (`q`, `status`, `sort`) so a "Back to People" link on another page can
 * restore the list exactly as it was left: `<a routerLink="/people" [queryParams]="listState.queryParams()">`.
 * The URL stays the source of truth; browser Back restores it without this service.
 */
@Injectable({ providedIn: 'root' })
export class PeopleListState {
  private readonly params = signal<Params>({});

  readonly queryParams = this.params.asReadonly();

  remember(params: Params): void {
    const kept: Params = {};
    for (const key of ['q', 'status', 'sort']) {
      if (params[key] != null && params[key] !== '') {
        kept[key] = params[key];
      }
    }
    this.params.set(kept);
  }
}
