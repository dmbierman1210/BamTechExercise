import { Directive, computed, inject } from '@angular/core';
import { ActorService } from './actor.service';

/**
 * Put on every button or control that makes a change. It is disabled, with a hint, until an actor name is set:
 * `<button mat-flat-button appActorRequired (click)="save()">Save</button>`
 * Do not combine it with a `[disabled]` binding on the same element; add other conditions in the click handler
 * or wrap them in a separate element.
 */
@Directive({
  selector: '[appActorRequired]',
  host: {
    '[attr.disabled]': 'blocked() ? "" : null',
    '[attr.aria-disabled]': 'blocked() ? "true" : null',
    '[attr.title]': 'blocked() ? hint : null',
    '[class.acts-actor-blocked]': 'blocked()',
  },
})
export class ActorRequiredDirective {
  private readonly actorService = inject(ActorService);

  protected readonly blocked = computed(() => !this.actorService.hasActor());
  protected readonly hint = this.actorService.hint;
}
