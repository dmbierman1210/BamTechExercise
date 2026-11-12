import { DestroyRef, Directive, ElementRef, computed, inject, input } from '@angular/core';
import { ActorService } from './actor.service';

/**
 * Put on every button or control that makes a change. Until an actor name is set it is blocked: it stays focusable
 * (`aria-disabled`, not the native `disabled`) so its hint can be found, and clicks are swallowed. Give it the id of
 * the element that shows the hint (`<app-actor-hint id="save-hint" />`) so it is announced as the description:
 * `<button mat-flat-button [appActorRequired]="'save-hint'" (click)="save()">Save</button>`
 * `[actorBusy]` blocks the control the same way while a request is pending (no double submit).
 * Do not combine it with a `[disabled]` binding on the same element.
 */
@Directive({
  selector: '[appActorRequired]',
  host: {
    '[attr.aria-disabled]': 'inactive() ? "true" : null',
    '[attr.aria-describedby]': 'blocked() && hintId() ? hintId() : null',
    '[attr.title]': 'blocked() ? hint : null',
    '[class.acts-actor-blocked]': 'inactive()',
  },
})
export class ActorRequiredDirective {
  private readonly actorService = inject(ActorService);

  /** Id of the element that shows the hint while no name is set. */
  readonly hintId = input<string>('', { alias: 'appActorRequired' });
  readonly actorBusy = input(false);

  protected readonly hint = this.actorService.hint;
  protected readonly blocked = computed(() => !this.actorService.hasActor());
  protected readonly inactive = computed(() => this.blocked() || this.actorBusy());

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Registered before the template's own (click) listener, so a blocked control never reaches it.
    const swallow = (event: Event) => {
      if (this.inactive()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    element.addEventListener('click', swallow, true);
    inject(DestroyRef).onDestroy(() => element.removeEventListener('click', swallow, true));
  }
}
