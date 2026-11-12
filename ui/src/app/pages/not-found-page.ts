import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="page">
      <div class="acts-panel not-found">
        <mat-icon aria-hidden="true">travel_explore</mat-icon>
        <h1>404: lost in space</h1>
        <p class="acts-muted">There is nothing at this address.</p>
        <a mat-flat-button routerLink="/people">Back to People</a>
      </div>
    </section>
  `,
  styles: `
    .not-found {
      display: grid;
      justify-items: center;
      gap: var(--acts-space-3);
      padding: var(--acts-space-8) var(--acts-space-4);
      text-align: center;
    }
    .not-found mat-icon {
      color: var(--acts-warn);
      font-size: 3rem;
      width: 3rem;
      height: 3rem;
    }
    h1,
    p {
      margin: 0;
    }
  `,
})
export class NotFoundPage {}
