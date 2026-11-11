import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PeopleListState } from './people-list-state';

/** Stand-in for the person page built in the next story (STAR-12); it replaces this route's component. */
@Component({
  selector: 'app-person-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="page">
      <a mat-button routerLink="/people" [queryParams]="listState.queryParams()">
        <mat-icon aria-hidden="true">arrow_back</mat-icon>
        Back to People
      </a>
      <h1>{{ name() }}</h1>
      <p class="acts-muted">The detail page and duty timeline arrive in the next story.</p>
    </section>
  `,
})
export class PersonPlaceholderPage {
  protected readonly listState = inject(PeopleListState);
  protected readonly name = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('name') ?? '')),
    { initialValue: '' },
  );
}
