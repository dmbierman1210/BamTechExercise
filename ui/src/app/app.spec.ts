import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { ACTOR_STORAGE_KEY } from './core/actor.service';

describe('App shell', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
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
});
