import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DutyService } from '../api/duty.service';
import type { AstronautDuty, CreateAstronautDutyRequest, PersonAstronaut } from '../api/models';
import { ActorHint } from '../core/actor-hint';
import { ActorRequiredDirective } from '../core/actor-required.directive';
import { formatDate, parseIsoDate, todayUtcIsoDate } from '../shared/dates';
import { FormAlert } from '../shared/form-alert';
import {
  REASON_MAX,
  TEXT_MAX,
  applyServerError,
  fieldErrorText,
  focusFirstInvalid,
  revalidate,
  trimmedText,
} from '../shared/form-errors';
import { latestDuty, reasonRequirement } from './duty-reason';

export const RETIRED_TITLE = 'RETIRED';

/**
 * Add duty form (`POST /AstronautDuty`). The reason becomes required, with an explanation banner, when the start
 * date is before the latest duty, after today (UTC) or the person is retired. Emits `saved` on success.
 */
@Component({
  selector: 'app-add-duty-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ActorHint,
    ActorRequiredDirective,
    FormAlert,
  ],
  templateUrl: './add-duty-form.html',
  styleUrl: './add-duty-form.scss',
})
export class AddDutyForm {
  private readonly duties = inject(DutyService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  readonly person = input.required<PersonAstronaut>();
  /** The person's duties, in any order. */
  readonly history = input.required<readonly AstronautDuty[]>();
  readonly saved = output();
  readonly cancelled = output();
  /** True while the request is in flight, so the parent does not close the form under it. */
  readonly busy = output<boolean>();

  protected readonly textMax = TEXT_MAX;
  protected readonly reasonMax = REASON_MAX;
  protected readonly retiredTitle = RETIRED_TITLE;

  protected readonly rank = new FormControl('', {
    nonNullable: true,
    validators: [trimmedText(TEXT_MAX)],
  });
  protected readonly dutyTitle = new FormControl('', {
    nonNullable: true,
    validators: [trimmedText(TEXT_MAX)],
  });
  protected readonly dutyStartDate = new FormControl(todayUtcIsoDate(), { nonNullable: true });
  protected readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [trimmedText(REASON_MAX, { required: false })],
  });
  protected readonly form = new FormGroup({
    rank: this.rank,
    dutyTitle: this.dutyTitle,
    dutyStartDate: this.dutyStartDate,
    reason: this.reason,
  });

  private readonly startDate = signal(this.dutyStartDate.value);
  protected readonly requirement = computed(() =>
    reasonRequirement(this.startDate(), this.history(), todayUtcIsoDate()),
  );
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => this.busy.emit(this.pending()));
    // Rules that read the inputs are added here: the controls are created before the inputs are set.
    this.dutyStartDate.addValidators((control) => this.validateDate(control));
    this.reason.addValidators((control) => this.validateReason(control));
    this.dutyStartDate.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.startDate.set(value));
    // The date and reason rules depend on the history and on the reason requirement, not only on their own value.
    effect(() => {
      this.requirement();
      this.history();
      untracked(() => {
        this.dutyStartDate.updateValueAndValidity();
        this.reason.updateValueAndValidity();
      });
    });
    afterNextRender(() => this.host.querySelector('input')?.focus());
  }

  /** The RETIRED quick-pick: fills the title and, when empty, the rank with the person's current one. */
  protected pickRetired(): void {
    this.dutyTitle.setValue(RETIRED_TITLE);
    this.dutyTitle.markAsDirty();
    if (!this.rank.value.trim()) {
      this.rank.setValue(latestDuty(this.history())?.rank ?? this.person().currentRank ?? '');
    }
  }

  protected cancel(): void {
    if (!this.pending()) {
      this.cancelled.emit();
    }
  }

  protected submit(): void {
    if (this.pending()) {
      return;
    }
    this.formError.set(null);
    revalidate(this.form);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      focusFirstInvalid(this.host);
      return;
    }
    const reason = this.reason.value.trim();
    const request: CreateAstronautDutyRequest = {
      name: this.person().name,
      rank: this.rank.value.trim(),
      dutyTitle: this.dutyTitle.value.trim(),
      dutyStartDate: this.dutyStartDate.value,
      ...(reason ? { reason } : {}),
    };
    this.pending.set(true);
    this.duties.createAstronautDuty(request).subscribe({
      next: () => this.saved.emit(),
      error: (error: unknown) => {
        this.pending.set(false);
        this.formError.set(
          applyServerError(error, {
            fields: {
              rank: this.rank,
              dutyTitle: this.dutyTitle,
              dutyStartDate: this.dutyStartDate,
              reason: this.reason,
            },
            conflict: this.dutyStartDate,
          }),
        );
        queueMicrotask(() => focusFirstInvalid(this.host));
      },
    });
  }

  protected errorOf(control: AbstractControl, label: string): string | null {
    return fieldErrorText(control, label);
  }

  private validateDate(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return { required: true };
    }
    if (!parseIsoDate(value)) {
      return { custom: 'Enter a valid date.' };
    }
    if (this.history().some((duty) => duty.dutyStartDate === value)) {
      return {
        custom: `A duty already starts on ${formatDate(value)}. Pick a different date.`,
      };
    }
    return null;
  }

  private validateReason(control: AbstractControl<string>): ValidationErrors | null {
    const needed = untracked(() => this.requirement());
    return needed && control.value.trim().length === 0
      ? { custom: 'A reason is required here: see the note above.' }
      : null;
  }
}
