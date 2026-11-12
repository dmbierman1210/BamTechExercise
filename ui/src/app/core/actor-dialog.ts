import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ACTOR_MAX_LENGTH, ActorService, validateActorName } from './actor.service';

function actorNameValidator(control: AbstractControl<string>): ValidationErrors | null {
  const message = validateActorName(control.value);
  return message ? { actorName: message } : null;
}

@Component({
  selector: 'app-actor-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Acting as</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <p class="acts-muted">
          Your name is sent with every change you make and recorded on the audit trail. It is
          <strong>self-declared, not verified</strong>.
        </p>
        <mat-form-field class="actor-field">
          <mat-label>Your name</mat-label>
          <input
            matInput
            formControlName="name"
            [maxlength]="maxLength + 50"
            autocomplete="name"
            required
            cdkFocusInitial
          />
          <mat-hint>1 to {{ maxLength }} characters</mat-hint>
          @if (name.errors?.['actorName']; as message) {
            <mat-error>{{ message }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (actors.hasActor()) {
          <button mat-button type="button" (click)="clear()">Clear name</button>
        }
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .actor-field {
      width: 100%;
      min-width: min(26rem, 70vw);
    }
  `,
})
export class ActorDialog {
  protected readonly actors = inject(ActorService);
  private readonly dialogRef = inject(MatDialogRef<ActorDialog>);
  protected readonly maxLength = ACTOR_MAX_LENGTH;
  protected readonly name = new FormControl(this.actors.actor() ?? '', {
    nonNullable: true,
    validators: [actorNameValidator],
  });
  protected readonly form = new FormGroup({ name: this.name });

  protected save(): void {
    this.name.markAsTouched();
    if (this.name.invalid) {
      return;
    }
    this.actors.setActor(this.name.value);
    this.dialogRef.close(true);
  }

  protected clear(): void {
    this.actors.clearActor();
    this.dialogRef.close(false);
  }
}
