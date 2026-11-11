import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ConnectionStatus } from './connection-status';

/**
 * Global banner for "offline", "API unreachable" and "API server error". The wrapper is always in the DOM
 * (`role="alert"`), so the text that appears inside it is announced.
 */
@Component({
  selector: 'app-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="region" role="alert">
      @if (status.problem(); as problem) {
        <div class="banner banner-{{ problem.kind }}">
          <mat-icon aria-hidden="true">{{
            problem.kind === 'server-error' ? 'report' : 'cloud_off'
          }}</mat-icon>
          <p class="message">{{ problem.message }}</p>
          @if (problem.kind === 'server-error') {
            <button mat-button type="button" (click)="status.dismiss()">Dismiss</button>
          } @else {
            <button mat-flat-button type="button" class="retry" (click)="status.retry()">
              <mat-icon aria-hidden="true">refresh</mat-icon>
              Retry
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .region:empty {
      display: none;
    }

    .banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--acts-space-2) var(--acts-space-3);
      padding: var(--acts-space-2) var(--acts-space-4);
      border-bottom: 1px solid var(--acts-warn);
      background: #2b2112;
      color: var(--acts-text);
    }

    .banner-offline,
    .banner-unreachable {
      border-bottom-color: var(--acts-danger);
      background: #2d1818;
    }

    mat-icon {
      flex: none;
      color: var(--acts-warn);
    }

    .banner-offline mat-icon,
    .banner-unreachable mat-icon {
      color: var(--acts-danger);
    }

    .message {
      flex: 1 1 14rem;
      margin: 0;
    }
  `,
})
export class ConnectionBanner {
  protected readonly status = inject(ConnectionStatus);
}
