import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { AstronautStatus } from '../api/models';

/** Badge text and icon; the label always carries the meaning so color is never the only signal. */
export const STATUS_BADGE: Record<AstronautStatus, { label: string; icon: string }> = {
  None: { label: 'Not an astronaut', icon: 'person_off' },
  Active: { label: 'Active', icon: 'rocket_launch' },
  Retired: { label: 'Retired', icon: 'military_tech' },
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span [class]="classes()">
      <mat-icon aria-hidden="true">{{ badge().icon }}</mat-icon>
      {{ badge().label }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      justify-self: start;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--acts-space-1);
      padding: 0.15rem 0.6rem 0.15rem 0.4rem;
      border: 1px solid currentcolor;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    mat-icon {
      width: 1.1rem;
      height: 1.1rem;
      font-size: 1.1rem;
    }

    .badge-active {
      color: var(--acts-success);
      background: rgb(110 231 168 / 12%);
    }

    .badge-retired {
      color: var(--acts-warn);
      background: rgb(255 180 84 / 12%);
    }

    .badge-none {
      color: var(--acts-text-muted);
      border-style: dashed;
    }
  `,
})
export class StatusBadge {
  readonly status = input.required<AstronautStatus>();

  protected readonly badge = computed(() => STATUS_BADGE[this.status()]);
  protected readonly classes = computed(() => `badge badge-${this.status().toLowerCase()}`);
}
