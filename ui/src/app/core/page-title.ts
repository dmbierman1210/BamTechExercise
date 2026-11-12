import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { type RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const APP_TITLE = 'Stargate ACTS';

/** "People - Stargate ACTS"; just the app name when a page has no title of its own. */
export function formatTitle(page?: string | null): string {
  return page ? `${page} - ${APP_TITLE}` : APP_TITLE;
}

/** Sets the document title. Pages call it when they know more than the route does (e.g. the canonical name). */
@Injectable({ providedIn: 'root' })
export class PageTitle {
  private readonly title = inject(Title);

  set(page?: string | null): void {
    this.title.setTitle(formatTitle(page));
  }
}

/** Gives every route `title` the same "<page> - Stargate ACTS" shape. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly pageTitle = inject(PageTitle);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.pageTitle.set(this.buildTitle(snapshot));
  }
}
