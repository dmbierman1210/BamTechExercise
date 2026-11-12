import { Injectable, signal, untracked } from '@angular/core';

/**
 * Text for the one persistent polite live region in the app shell. Pages announce loading and count changes here
 * instead of inserting `role="status"` elements that already hold text (screen readers often skip those).
 */
@Injectable({ providedIn: 'root' })
export class StatusAnnouncer {
  private flip = false;
  private readonly text = signal('');

  readonly message = this.text.asReadonly();

  announce(message: string): void {
    // A trailing no-break space makes a repeated message a real change, so it is announced again.
    this.flip = message === untracked(() => this.text()).trim() ? !this.flip : false;
    this.text.set(this.flip ? `${message}\u00a0` : message);
  }

  clear(): void {
    this.text.set('');
  }
}
