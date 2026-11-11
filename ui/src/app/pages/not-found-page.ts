import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { StateNotice } from '../shared/state-notice';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, StateNotice],
  template: `
    <section class="acts-page">
      <app-state-notice illustration="not-found" heading="Page not found" [headingLevel]="1">
        <p class="acts-muted">Error 404: there is nothing at this address.</p>
        <a mat-flat-button routerLink="/people">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          Back to People
        </a>
      </app-state-notice>
    </section>
  `,
})
export class NotFoundPage {}
