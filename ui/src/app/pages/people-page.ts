import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-people-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <section class="page">
      <h1>People</h1>
      <div class="acts-panel placeholder">
        <mat-icon aria-hidden="true">groups</mat-icon>
        <p>The personnel roster arrives in the next story.</p>
        <p class="acts-muted">Astronauts, their status and duty timelines will be listed here.</p>
      </div>
    </section>
  `,
  styles: `
    .placeholder {
      display: grid;
      justify-items: center;
      gap: var(--acts-space-2);
      padding: var(--acts-space-8) var(--acts-space-4);
      text-align: center;
    }
    .placeholder mat-icon {
      color: var(--acts-accent);
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
    }
    p {
      margin: 0;
    }
  `,
})
export class PeoplePage {}
