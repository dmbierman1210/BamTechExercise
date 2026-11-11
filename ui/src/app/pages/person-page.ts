import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { ApiError } from '../api/api-error';
import { DutyService } from '../api/duty.service';
import type { PersonAstronaut } from '../api/models';
import { formatCareerLength, formatDate } from '../shared/dates';
import { StatusBadge } from '../shared/status-badge';
import { PeopleListState } from './people-list-state';
import { type TimelineEntry, toTimeline } from './person-timeline';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; person: PersonAstronaut; entries: TimelineEntry[] };

@Component({
  selector: 'app-person-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, StatusBadge],
  templateUrl: './person-page.html',
  styleUrl: './person-page.scss',
})
export class PersonPage {
  private readonly duties = inject(DutyService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  protected readonly listState = inject(PeopleListState);
  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  protected readonly skeletonRows = [1, 2, 3];
  protected readonly formatDate = formatDate;

  /** The route param, already decoded by the router (spaces, slashes, ?, % survive). */
  protected readonly name = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('name') ?? '')),
    { initialValue: '' },
  );
  protected readonly state = signal<LoadState>({ kind: 'loading' });

  protected readonly person = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.person : null;
  });
  protected readonly entries = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.entries : [];
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : '';
  });
  protected readonly title = computed(() => this.person()?.name ?? this.name());
  protected readonly careerLength = computed(() => {
    const person = this.person();
    return person ? formatCareerLength(person.careerStartDate, person.careerEndDate) : null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
    effect(() => {
      const name = this.name();
      untracked(() => {
        this.load(name);
        this.focusHeading();
      });
    });
  }

  protected retry(): void {
    this.load(this.name());
    this.heading()?.nativeElement.focus();
  }

  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }

  private load(name: string): void {
    this.request?.unsubscribe();
    this.state.set({ kind: 'loading' });
    this.request = this.duties.getAstronautDutiesByName(name).subscribe({
      next: (response) =>
        this.state.set({
          kind: 'loaded',
          person: response.person,
          entries: toTimeline(response.astronautDuties),
        }),
      error: (error: unknown) =>
        this.state.set(
          error instanceof ApiError && error.status === 404
            ? { kind: 'not-found' }
            : {
                kind: 'error',
                message:
                  error instanceof ApiError ? error.message : 'Something went wrong. Try again.',
              },
        ),
    });
  }
}
