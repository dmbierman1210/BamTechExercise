import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { ApiError } from './api/api-error';
import { ACTOR_STORAGE_KEY } from './core/actor.service';
import { ConnectionStatus } from './core/connection-status';
import { AppTitleStrategy } from './core/page-title';
import { StatusAnnouncer } from './core/status-announcer';

describe('App shell', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  function render() {
    return TestBed.createComponent(App);
  }

  it('renders the toolbar with app name, navigation and the Acting as control', async () => {
    const fixture = render();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-toolbar')).toBeTruthy();
    expect(el.querySelector('.brand-name')?.textContent).toContain('Stargate ACTS');
    expect(el.querySelector('nav[aria-label="Main"] a')?.textContent).toContain('People');
    expect(el.querySelector('app-acting-as button')?.textContent).toContain('Set your name');
  });

  it('redirects / to /people and shows the People placeholder', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/people');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'People',
    );
  });

  it('shows the 404 page for an unknown route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/does/not/exist');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('404');
  });

  it('shows the stored actor name in the toolbar', async () => {
    localStorage.setItem(ACTOR_STORAGE_KEY, 'Ada Lovelace');
    const fixture = render();
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).querySelector('app-acting-as')?.textContent;
    expect(text).toContain('Acting as');
    expect(text).toContain('Ada Lovelace');
  });

  it('has a skip link that moves focus to the main landmark', async () => {
    const fixture = render();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const skip = el.querySelector<HTMLAnchorElement>('a.skip-link')!;
    expect(skip.getAttribute('href')).toBe('#main');
    expect(skip.textContent).toContain('Skip to content');
    skip.click();
    expect(document.activeElement).toBe(el.querySelector('main#main'));
  });

  it('has one persistent polite live region that shows what the pages announce', async () => {
    const fixture = render();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const region = el.querySelector('[role="status"][aria-live="polite"]')!;
    expect(region.textContent?.trim()).toBe('');
    TestBed.inject(StatusAnnouncer).announce('Showing 3 of 3 people.');
    await fixture.whenStable();
    expect(el.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(region.textContent?.trim()).toBe('Showing 3 of 3 people.');
  });

  it('shows the global banner with Retry when the API cannot be reached', async () => {
    const fixture = render();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-connection-banner .banner')).toBeNull();
    TestBed.inject(ConnectionStatus).reportFailure(new ApiError(0, 'down'));
    await fixture.whenStable();
    expect(el.querySelector('app-connection-banner')?.textContent).toContain(
      'Cannot reach the API',
    );
    expect(el.querySelector('app-connection-banner button.retry')).not.toBeNull();
  });

  describe('focus after navigation', () => {
    const heading = (fixture: ComponentFixture<App>) =>
      (fixture.nativeElement as HTMLElement).querySelector('main h1');

    it('does not steal focus on the first load or when only the query string changes', async () => {
      const fixture = render();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/people');
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
      await router.navigateByUrl('/people?q=jo');
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });

    it('moves focus to the new page heading when the page changes', async () => {
      const fixture = render();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/people');
      await fixture.whenStable();
      await router.navigateByUrl('/people/John%20Doe');
      await fixture.whenStable();
      await vi.waitFor(() => expect(document.activeElement).toBe(heading(fixture)));
      expect(heading(fixture)?.textContent).toContain('John Doe');
    });

    it('focuses the 404 heading', async () => {
      const fixture = render();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/people');
      await fixture.whenStable();
      await router.navigateByUrl('/does/not/exist');
      await fixture.whenStable();
      await vi.waitFor(() => expect(document.activeElement).toBe(heading(fixture)));
      expect(heading(fixture)?.textContent).toContain('Page not found');
    });
  });

  it('titles the 404 route "Page not found - Stargate ACTS"', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/does/not/exist');
    expect(TestBed.inject(Title).getTitle()).toBe('Page not found - Stargate ACTS');
  });
});
