import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { ApiError } from '../api/api-error';
import type { PersonAstronaut } from '../api/models';
import { PersonService } from '../api/person.service';
import { ActorService } from '../core/actor.service';
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
  imports: [MatButtonModule, MatIconModule, MatInputModule, RouterLink, StatusBadge],
  templateUrl: './people-page.html',
  styleUrl: './people-page.scss',
})
export class PeoplePage {
  private readonly people = inject(PersonService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listState = inject(PeopleListState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly actors = inject(ActorService);
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
  /** The Add person action only exists as a placeholder until STAR-13 builds it. */
  protected readonly addHint = computed(() =>
    this.actors.hasActor() ? 'Adding people is not available yet.' : this.actors.hint,
  );

  constructor() {
    effect(() => this.listState.remember(toQueryParams(this.filters())));
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.state.set({ kind: 'loading' });
    this.request = this.people.getPeople().subscribe({
      next: (response) => this.state.set({ kind: 'loaded', people: response.people }),
      error: (error: unknown) =>
        this.state.set({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'Something went wrong. Try again.',
        }),
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
