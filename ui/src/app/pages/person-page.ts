import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { ApiError } from '../api/api-error';
import { DutyService } from '../api/duty.service';
import type { AstronautDuty, PersonAstronaut } from '../api/models';
import { ActorHint } from '../core/actor-hint';
import { ActorRequiredDirective } from '../core/actor-required.directive';
import { Notifier } from '../core/notifier';
import { formatCareerLength, formatDate } from '../shared/dates';
import { StatusBadge } from '../shared/status-badge';
import { AddDutyForm } from './add-duty-form';
import { PeopleListState } from './people-list-state';
import { type TimelineEntry, toTimeline } from './person-timeline';
import { RenamePersonForm } from './rename-person-form';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; person: PersonAstronaut; entries: TimelineEntry[] };

type Panel = 'none' | 'rename' | 'duty';

@Component({
  selector: 'app-person-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    StatusBadge,
    ActorHint,
    ActorRequiredDirective,
    AddDutyForm,
    RenamePersonForm,
  ],
  templateUrl: './person-page.html',
  styleUrl: './person-page.scss',
})
export class PersonPage {
  private readonly duties = inject(DutyService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  protected readonly listState = inject(PeopleListState);
  protected readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  protected readonly renameButton = viewChild('renameButton', { read: ElementRef });
  protected readonly dutyButton = viewChild('dutyButton', { read: ElementRef });
  protected readonly skeletonRows = [1, 2, 3];
  protected readonly formatDate = formatDate;

  /** The route param, already decoded by the router (spaces, slashes, ?, % survive). */
  protected readonly name = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('name') ?? '')),
    { initialValue: '' },
  );
  protected readonly state = signal<LoadState>({ kind: 'loading' });
  /** Which write form is open. */
  protected readonly panel = signal<Panel>('none');
  /** True while a write request from an open form is in flight; the panels cannot be closed meanwhile. */
  protected readonly writing = signal(false);

  protected readonly person = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.person : null;
  });
  protected readonly entries = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.entries : [];
  });
  protected readonly history = computed<AstronautDuty[]>(() =>
    this.entries().map((entry) => entry.duty),
  );
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
        this.panel.set('none');
        this.writing.set(false);
        this.load(name);
        this.focusHeading();
      });
    });
  }

  protected retry(): void {
    this.load(this.name());
    this.heading()?.nativeElement.focus();
  }

  protected toggle(panel: Exclude<Panel, 'none'>): void {
    if (this.writing()) {
      return;
    }
    this.panel.update((current) => (current === panel ? 'none' : panel));
  }

  protected closePanel(): void {
    const previous = this.panel();
    this.panel.set('none');
    this.writing.set(false);
    this.focusAfterRender(previous === 'rename' ? this.renameButton : this.dutyButton);
  }

  protected onRenamed(newName: string): void {
    this.panel.set('none');
    this.writing.set(false);
    this.notifier.confirm(`Renamed to ${newName}.`);
    if (newName === this.name()) {
      this.load(newName, true);
      this.focusAfterRender(this.renameButton);
      return;
    }
    // The route param changes, which reloads the page for the new name; replaceUrl keeps Back from reaching the old name.
    void this.router.navigate(['/people', newName], { replaceUrl: true });
  }

  protected onDutySaved(): void {
    this.panel.set('none');
    this.writing.set(false);
    this.notifier.confirm('Duty added.');
    this.load(this.name(), true);
    this.focusAfterRender(this.dutyButton);
  }

  private focusHeading(): void {
    this.focusAfterRender(this.heading);
  }

  private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }

  /** `refresh` keeps showing the current data (and the open forms) until the new data arrives. */
  private load(name: string, refresh = false): void {
    this.request?.unsubscribe();
    if (!refresh) {
      this.state.set({ kind: 'loading' });
    }
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
