import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IllustrationKind = 'people' | 'search' | 'duties' | 'error' | 'not-found' | 'offline';

/** Decorative inline SVG artwork for empty, error and 404 states (own drawings, no external files). */
@Component({
  selector: 'app-illustration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 160 112"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <g class="stars">
        <circle cx="18" cy="20" r="2" />
        <circle cx="142" cy="16" r="2.5" />
        <circle cx="148" cy="86" r="2" />
        <circle cx="12" cy="92" r="2.5" />
        <circle cx="116" cy="8" r="1.5" />
      </g>
      @switch (kind()) {
        @case ('people') {
          <circle class="soft a" cx="80" cy="56" r="28" />
          <ellipse class="a" cx="80" cy="58" rx="56" ry="13" transform="rotate(-16 80 58)" />
          <circle class="a" cx="80" cy="50" r="7" />
          <path class="a" d="M66 72c2-9 9-13 14-13s12 4 14 13" />
        }
        @case ('search') {
          <circle class="soft a" cx="70" cy="50" r="26" />
          <path class="a" d="M89 69l24 24" stroke-width="6" />
          <path class="w" d="M70 38v24M58 50h24" />
        }
        @case ('duties') {
          <path class="soft a" d="M80 12c14 12 20 30 18 50H62c-2-20 4-38 18-50z" />
          <circle class="a" cx="80" cy="38" r="7" />
          <path class="a" d="M62 62l-14 16 16-4M98 62l14 16-16-4" />
          <path class="w" d="M72 70c0 10 4 20 8 28 4-8 8-18 8-28" />
        }
        @case ('error') {
          <circle class="soft a" cx="80" cy="56" r="30" />
          <path class="d" d="M80 38v22" stroke-width="5" />
          <circle class="d-fill" cx="80" cy="73" r="3.5" />
          <path class="a" d="M40 90c18 12 62 12 80 0" />
        }
        @case ('not-found') {
          <circle class="soft a" cx="80" cy="52" r="30" />
          <ellipse class="w" cx="82" cy="52" rx="19" ry="14" />
          <path class="a" d="M66 80l-8 14M94 80l8 14" />
          <path class="w" d="M74 48c2-6 12-6 12 0 0 4-6 4-6 9M80 62v.5" />
        }
        @case ('offline') {
          <path
            class="a"
            d="M52 48a40 40 0 0 1 56 0M62 60a26 26 0 0 1 36 0M72 72a12 12 0 0 1 16 0"
          />
          <circle class="a-fill" cx="80" cy="84" r="4" />
          <path class="d" d="M42 24l76 72" stroke-width="5" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
      width: 9rem;
      max-width: 60%;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
    }

    .stars circle {
      fill: var(--acts-text-muted);
    }

    .a {
      stroke: var(--acts-accent);
    }

    .w {
      stroke: var(--acts-warn);
    }

    .d {
      stroke: var(--acts-danger);
    }

    .a-fill {
      fill: var(--acts-accent);
      stroke: none;
    }

    .d-fill {
      fill: var(--acts-danger);
      stroke: none;
    }

    .soft {
      fill: var(--acts-accent-soft);
    }
  `,
})
export class Illustration {
  readonly kind = input.required<IllustrationKind>();
}
