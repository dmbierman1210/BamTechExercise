import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { filter } from 'rxjs';
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

/** Add person dialog (`POST /Person`). Closes with the new person's name on success. */
@Component({
  selector: 'app-add-person-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ActorHint,
    ActorRequiredDirective,
    FormAlert,
  ],
  template: `
    <h2 mat-dialog-title>Add person</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field class="name-field">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" autocomplete="off" required cdkFocusInitial />
          <mat-hint>Up to {{ nameMax }} characters; names are unique, ignoring case.</mat-hint>
          @if (nameError(); as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
        @if (formError(); as message) {
          <app-form-alert [message]="message" (dismissed)="formError.set(null)" />
        }
        @if (discardHint()) {
          <p class="acts-discard-hint">{{ discardText }}</p>
        }
        <app-actor-hint id="add-person-submit-hint" />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="pending()">Cancel</button>
        <button
          mat-flat-button
          type="submit"
          appActorRequired="add-person-submit-hint"
          [actorBusy]="pending()"
        >
          {{ pending() ? 'Adding…' : 'Add person' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .name-field {
      width: 100%;
      min-width: min(26rem, 70vw);
    }
  `,
})
export class AddPersonDialog {
  private readonly people = inject(PersonService);
  private readonly dialogRef = inject<MatDialogRef<AddPersonDialog, string>>(MatDialogRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer = inject(StatusAnnouncer);

  protected readonly nameMax = NAME_MAX;
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: [trimmedText(NAME_MAX)],
  });
  protected readonly form = new FormGroup({ name: this.name });
  protected readonly pending = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly nameError = signal<string | null>(null);
  protected readonly discardHint = signal(false);
  protected readonly discardText = DISCARD_HINT;

  constructor() {
    this.name.statusChanges.subscribe(() => this.nameError.set(this.currentNameError()));
    // Typed text is never discarded by Escape or a backdrop click; only the Cancel button closes the dialog then.
    this.name.valueChanges.subscribe(() => {
      this.discardHint.set(false);
      this.dialogRef.disableClose = this.name.dirty;
    });
    const refuse = () => {
      if (this.dialogRef.disableClose && !this.pending()) {
        this.discardHint.set(true);
        this.announcer.announce(DISCARD_HINT);
      }
    };
    this.dialogRef
      .keydownEvents()
      .pipe(filter((event) => event.key === 'Escape'))
      .subscribe(refuse);
    this.dialogRef.backdropClick().subscribe(refuse);
  }

  protected submit(): void {
    if (this.pending()) {
      return;
    }
    this.formError.set(null);
    revalidate(this.form);
    this.name.markAsTouched();
    this.nameError.set(this.currentNameError());
    if (this.form.invalid) {
      this.announcer.announce(invalidSummary('add the person', [this.name]));
      focusFirstInvalid(this.host);
      return;
    }
    const name = this.name.value.trim();
    this.pending.set(true);
    this.dialogRef.disableClose = true;
    this.people.createPerson({ name }).subscribe({
      next: () => this.dialogRef.close(name),
      error: (error: unknown) => {
        this.pending.set(false);
        this.dialogRef.disableClose = this.name.dirty;
        this.formError.set(
          applyServerError(error, { fields: { name: this.name }, conflict: this.name }),
        );
        this.nameError.set(this.currentNameError());
        queueMicrotask(() => focusFirstInvalid(this.host));
      },
    });
  }

  private currentNameError(): string | null {
    return fieldErrorText(this.name, 'The name');
  }
}
