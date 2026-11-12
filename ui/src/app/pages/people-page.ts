import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { ApiError } from '../api/api-error';
import type { PersonAstronaut } from '../api/models';
import { PersonService } from '../api/person.service';
import { ActorHint } from '../core/actor-hint';
import { ActorRequiredDirective } from '../core/actor-required.directive';
import { ConnectionStatus } from '../core/connection-status';
import { Notifier } from '../core/notifier';
import { StatusAnnouncer } from '../core/status-announcer';
import { StateNotice } from '../shared/state-notice';
import { AddPersonDialog } from './add-person-dialog';
import {
  type ListFilters,
  type SortOrder,
  type StatusFilter,
  DEFAULT_FILTERS,
  SORT_ORDERS,
  STATUS_FILTERS,
  filterAndSort,
  hasActiveFilters,
  parseFilters,
  toQueryParams,
} from './people-list';
import { PeopleListState } from './people-list-state';
import { StatusBadge } from '../shared/status-badge';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; people: PersonAstronaut[] };

@Component({
  selector: 'app-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    StatusBadge,
    StateNotice,
    ActorHint,
    ActorRequiredDirective,
  ],
  templateUrl: './people-page.html',
  styleUrl: './people-page.scss',
})
export class PeoplePage {
  private readonly people = inject(PersonService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listState = inject(PeopleListState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  private readonly announcer = inject(StatusAnnouncer);
  private readonly connection = inject(ConnectionStatus);
  private request?: Subscription;

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly sortOrders = SORT_ORDERS;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  protected readonly state = signal<LoadState>({ kind: 'loading' });
  protected readonly filters = toSignal(
    this.route.queryParamMap.pipe(map((params) => parseFilters(params))),
    { initialValue: DEFAULT_FILTERS },
  );
  protected readonly filtering = computed(() => hasActiveFilters(this.filters()));
  protected readonly all = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.people : [];
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : '';
  });
  protected readonly visible = computed(() => filterAndSort(this.all(), this.filters()));
  /** What the shell's live region says: loading, then the count (errors are announced by their own alert). */
  protected readonly statusText = computed(() => {
    const state = this.state();
    if (state.kind === 'loading') {
      return 'Loading people…';
    }
    if (state.kind === 'error') {
      return null;
    }
    if (state.people.length === 0) {
      return 'No people yet.';
    }
    const shown = this.visible().length;
    return shown === 0
      ? 'No matches.'
      : `Showing ${shown} of ${state.people.length} ${state.people.length === 1 ? 'person' : 'people'}.`;
  });

  /** Opens the Add person dialog; on success goes to the new person (the list reloads when it is opened again). */
  protected addPerson(): void {
    this.dialog
      .open<AddPersonDialog, undefined, string>(AddPersonDialog, {
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((name) => {
        if (name) {
          this.notifier.confirm(`Added ${name}.`);
          void this.router.navigate(['/people', name]);
        }
      });
  }

  constructor() {
    effect(() => this.listState.remember(toQueryParams(this.filters())));
    effect(() => {
      const text = this.statusText();
      if (text) {
        this.announcer.announce(text);
      }
    });
    let lastTick = this.connection.retryTick();
    effect(() => {
      const tick = this.connection.retryTick();
      if (tick !== lastTick) {
        lastTick = tick;
        untracked(() => this.load(this.state().kind === 'loaded'));
      }
    });
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  /** `refresh` keeps showing the current list (and the user's place in it) until the new data arrives. */
  protected load(refresh = false): void {
    this.request?.unsubscribe();
    if (!refresh) {
      this.state.set({ kind: 'loading' });
    }
    this.request = this.people.getPeople().subscribe({
      next: (response) => this.state.set({ kind: 'loaded', people: response.people }),
      error: (error: unknown) => {
        if (refresh) {
          return;
        }
        this.state.set({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'Something went wrong. Try again.',
        });
      },
    });
  }

  protected setSearch(q: string): void {
    this.update({ q });
  }

  protected setStatus(value: string): void {
    this.update({ status: value as StatusFilter });
  }

  protected setSort(value: string): void {
    this.update({ sort: value as SortOrder });
  }

  protected clearFilters(): void {
    this.update({ q: '', status: 'all' });
  }

  private update(patch: Partial<ListFilters>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams({ ...this.filters(), ...patch }),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
