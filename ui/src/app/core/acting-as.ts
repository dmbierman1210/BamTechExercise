import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ActorDialog } from './actor-dialog';
import { ActorService } from './actor.service';

/** Toolbar control showing who is "acting"; opens the dialog to set or change the name. */
@Component({
  selector: 'app-acting-as',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <button
      mat-stroked-button
      type="button"
      class="acting-as"
      [class.acting-as-missing]="!actors.hasActor()"
      [attr.aria-label]="
        actors.hasActor()
          ? 'Acting as ' + actors.actor() + ' (self-declared, not verified). Change name'
          : 'Set your name. Acting as is self-declared, not verified'
      "
      title="Self-declared, not verified"
      (click)="open()"
    >
      <mat-icon aria-hidden="true">badge</mat-icon>
      <span class="acting-as-text">
        @if (actors.actor(); as name) {
          <span class="acting-as-label">Acting as</span>
          <span class="acting-as-name">{{ name }}</span>
        } @else {
          <span class="acting-as-name">Set your name</span>
        }
      </span>
    </button>
  `,
  styles: `
    .acting-as {
      max-width: min(18rem, 46vw);
      --mat-button-outlined-label-text-color: var(--acts-text);
      --mat-button-outlined-outline-color: var(--acts-border-strong);
    }
    .acting-as-missing {
      --mat-button-outlined-label-text-color: var(--acts-warn);
      --mat-button-outlined-outline-color: var(--acts-warn);
    }
    .acting-as-text {
      display: inline-flex;
      align-items: baseline;
      gap: var(--acts-space-2);
      min-width: 0;
    }
    .acting-as-label {
      color: var(--acts-text-muted);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .acting-as-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (max-width: 599.98px) {
      .acting-as-label {
        display: none;
      }
    }
  `,
})
export class ActingAs {
  protected readonly actors = inject(ActorService);
  private readonly dialog = inject(MatDialog);

  protected open(): void {
    this.dialog.open(ActorDialog, { autoFocus: 'input', width: '32rem', maxWidth: '94vw' });
  }
}
