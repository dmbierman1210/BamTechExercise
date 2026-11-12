import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActorService } from './actor.service';

/**
 * The visible hint for write actions: shown while no actor name is set. Give it an id and point the blocked
 * control at it with `[appActorRequired]="id"`.
 */
@Component({
  selector: 'app-actor-hint',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (!actors.hasActor()) {
      <mat-icon aria-hidden="true">lock</mat-icon>
      <span>{{ actors.hint }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--acts-space-2);
      color: var(--acts-warn);
      font-size: 0.9rem;
    }

    :host:empty {
      display: none;
    }

    mat-icon {
      flex: none;
      width: 1.1rem;
      height: 1.1rem;
      font-size: 1.1rem;
    }
  `,
})
export class ActorHint {
  protected readonly actors = inject(ActorService);
}
