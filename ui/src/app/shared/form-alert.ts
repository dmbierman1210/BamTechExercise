import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** A form-level error that is not tied to a field; the user can dismiss it. */
@Component({
  selector: 'app-form-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="alert" role="alert">
      <mat-icon aria-hidden="true">error</mat-icon>
      <p>{{ message() }}</p>
      <button mat-icon-button type="button" aria-label="Dismiss message" (click)="dismissed.emit()">
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .alert {
      display: flex;
      align-items: center;
      gap: var(--acts-space-3);
      padding: var(--acts-space-2) var(--acts-space-2) var(--acts-space-2) var(--acts-space-4);
      border: 1px solid var(--acts-danger);
      border-radius: var(--acts-radius);
      background: rgb(255 138 138 / 10%);
    }

    mat-icon {
      color: var(--acts-danger);
    }

    p {
      flex: 1;
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class FormAlert {
  readonly message = input.required<string>();
  readonly dismissed = output();
}
