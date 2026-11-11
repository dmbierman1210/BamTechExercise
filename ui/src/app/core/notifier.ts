import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Confirmation messages after a successful change; announced politely by screen readers. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);

  confirm(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 6000, politeness: 'polite' });
  }
}
