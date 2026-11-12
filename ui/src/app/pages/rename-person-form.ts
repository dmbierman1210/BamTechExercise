import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  type OnInit,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PersonService } from '../api/person.service';
import { ActorHint } from '../core/actor-hint';
import { ActorRequiredDirective } from '../core/actor-required.directive';
import { StatusAnnouncer } from '../core/status-announcer';
import { FormAlert } from '../shared/form-alert';
import {
  DISCARD_HINT,
  NAME_MAX,
  applyServerError,
  fieldErrorText,
  focusFirstInvalid,
  invalidSummary,
  revalidate,
  trimmedText,
} from '../shared/form-errors';

/** Inline rename form (`PUT /Person/{name}`). Emits the new name on success; the parent updates the URL. */
@Component({
  selector: 'app-rename-person-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ActorHint,
    ActorRequiredDirective,
    FormAlert,
  ],
  template: `
    <form
      class="rename acts-panel"
      [formGroup]="form"
      aria-label="Rename person"
      (ngSubmit)="submit()"
      (keydown.escape)="escape()"
    >
      <mat-form-field class="rename-field" subscriptSizing="dynamic">
        <mat-label>New name</mat-label>
        <input matInput formControlName="newName" autocomplete="off" required #input />
        <mat-hint>Up to {{ nameMax }} characters. A change of letter case is allowed.</mat-hint>
        @if (nameError(); as message) {
          <mat-error>{{ message }}</mat-error>
        }
      </mat-form-field>
      @if (unchanged()) {
        <p class="unchanged acts-muted">
          That is already this person's name. Type a different name to rename.
        </p>
      }
      @if (formError(); as message) {
        <app-form-alert [message]="message" (dismissed)="formError.set(null)" />
      }
      @if (discardHint()) {
        <p class="acts-discard-hint">{{ discardText }}</p>
      }
      <app-actor-hint id="rename-submit-hint" />
      <div class="actions">
        <button
          mat-flat-button
          type="submit"
          appActorRequired="rename-submit-hint"
          [actorBusy]="pending()"
        >
          {{ pending() ? 'Renaming…' : 'Rename' }}
        </button>
        <button mat-button type="button" (click)="cancel()">Cancel</button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--acts-space-6);
    }

    .rename {
      display: grid;
      gap: var(--acts-space-3);
      padding: var(--acts-space-4) var(--acts-space-6);
    }

    .rename-field {
      width: 100%;
      max-width: 32rem;
    }

    .unchanged {
      margin: 0;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--acts-space-2);
    }

    @media (max-width: 599.98px) {
      .rename {
        padding: var(--acts-space-4);
      }
    }
  `,
})
export class RenamePersonForm implements OnInit {
  private readonly people = inject(PersonService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer = inject(StatusAnnouncer);

  /** The person's current (canonical) name. */
  readonly currentName = input.required<string>();
  readonly renamed = output<string>();
  readonly cancelled = output();
  /** True while the request is in flight, so the parent does not close the form under it. */
  readonly busy = output<boolean>();

  protected readonly nameMax = NAME_MAX;
  protected readonly newName = new FormControl('', {
    nonNullable: true,
    validators: [trimmedText(NAME_MAX)],
  });
  protected readonly form = new FormGroup({ newName: this.newName });
  protected readonly pending = signal(false);
  protected readonly unchanged = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly nameError = signal<string | null>(null);
  protected readonly discardHint = signal(false);
  protected readonly discardText = DISCARD_HINT;

  constructor() {
    effect(() => this.busy.emit(this.pending()));
    this.newName.valueChanges.subscribe(() => {
      this.unchanged.set(false);
      this.discardHint.set(false);
    });
    this.newName.statusChanges.subscribe(() => this.refreshError());
    afterNextRender(() => {
      const field = this.host.querySelector('input');
      field?.focus();
      field?.select();
    });
  }

  ngOnInit(): void {
    this.newName.setValue(this.currentName());
  }

  protected cancel(): void {
    if (!this.pending()) {
      this.cancelled.emit();
    }
  }

  /** Escape closes the form only while the name is unchanged; otherwise it explains how to discard. */
  protected escape(): void {
    if (this.pending()) {
      return;
    }
    if (this.newName.value.trim() !== this.currentName()) {
      this.discardHint.set(true);
      this.announcer.announce(DISCARD_HINT);
      return;
    }
    this.cancelled.emit();
  }

  protected submit(): void {
    if (this.pending()) {
      return;
    }
    this.formError.set(null);
    revalidate(this.form);
    this.newName.markAsTouched();
    this.refreshError();
    if (this.form.invalid) {
      this.announcer.announce(invalidSummary('rename', [this.newName]));
      focusFirstInvalid(this.host);
      return;
    }
    const newName = this.newName.value.trim();
    // Only a case-only change differs from the current name when compared exactly; both are real renames.
    if (newName === this.currentName()) {
      this.unchanged.set(true);
      this.announcer.announce("That is already this person's name.");
      return;
    }
    this.pending.set(true);
    this.people.renamePerson(this.currentName(), { newName }).subscribe({
      next: () => this.renamed.emit(newName),
      error: (error: unknown) => {
        this.pending.set(false);
        this.formError.set(
          applyServerError(error, { fields: { newName: this.newName }, conflict: this.newName }),
        );
        this.refreshError();
        queueMicrotask(() => focusFirstInvalid(this.host));
      },
    });
  }

  private refreshError(): void {
    this.nameError.set(fieldErrorText(this.newName, 'The new name'));
  }
}
