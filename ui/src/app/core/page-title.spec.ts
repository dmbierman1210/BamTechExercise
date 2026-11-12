import { Title } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { APP_TITLE, AppTitleStrategy, PageTitle, formatTitle } from './page-title';
import { routes } from '../app.routes';

describe('page titles', () => {
  it('formats "<page> - Stargate ACTS" and falls back to the app name', () => {
    expect(formatTitle('People')).toBe('People - Stargate ACTS');
    expect(formatTitle()).toBe(APP_TITLE);
    expect(formatTitle('')).toBe(APP_TITLE);
  });

  it('PageTitle sets the document title', () => {
    TestBed.inject(PageTitle).set('Jane Roe');
    expect(TestBed.inject(Title).getTitle()).toBe('Jane Roe - Stargate ACTS');
  });

  describe('title strategy with the app routes', () => {
    let router: Router;
    let title: Title;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter(routes),
          { provide: TitleStrategy, useExisting: AppTitleStrategy },
        ],
      });
      router = TestBed.inject(Router);
      title = TestBed.inject(Title);
    });

    it.each([
      ['/people', 'People - Stargate ACTS'],
      ['/people/Jane%20Roe', 'Jane Roe - Stargate ACTS'],
      ['/people/A%2FB%3F%20100%25', 'A/B? 100% - Stargate ACTS'],
      ['/nowhere/at/all', 'Page not found - Stargate ACTS'],
    ])('%s sets the title to %s', async (url, expected) => {
      await router.navigateByUrl(url);
      expect(title.getTitle()).toBe(expected);
    });

    it('redirects / to People', async () => {
      await router.navigateByUrl('/');
      expect(title.getTitle()).toBe('People - Stargate ACTS');
    });
  });
});
