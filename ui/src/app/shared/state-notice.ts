import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Illustration, type IllustrationKind } from './illustration';

/**
 * The one look for empty, "not found" and error states: illustration, heading and projected text and actions.
 * Layout lives in the global `.acts-notice` class (styles.scss). Set `alert` for errors that appear after loading.
 */
@Component({
  selector: 'app-state-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Illustration],
  host: {
    class: 'acts-panel acts-notice notice',
    '[attr.role]': 'alert() ? "alert" : null',
  },
  template: `
    <app-illustration [kind]="illustration()" />
    @if (headingLevel() === 1) {
      <h1 tabindex="-1">{{ heading() }}</h1>
    } @else {
      <h2>{{ heading() }}</h2>
    }
    <ng-content />
  `,
})
export class StateNotice {
  readonly illustration = input.required<IllustrationKind>();
  readonly heading = input.required<string>();
  readonly headingLevel = input<1 | 2>(2);
  readonly alert = input(false);
}
