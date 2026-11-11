import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { errorInterceptor } from '../api/error.interceptor';
import type { PersonAstronaut } from '../api/models';
import { ActorService } from '../core/actor.service';
import { StatusAnnouncer } from '../core/status-announcer';
import { PeopleListState } from './people-list-state';
import { PeoplePage } from './people-page';
import { PersonPage } from './person-page';

const FIXTURE: PersonAstronaut[] = [
  {
    personId: 1,
    name: 'John Doe',
    currentRank: '1LT',
    currentDutyTitle: 'Commander',
    careerStartDate: '2020-01-15',
    careerEndDate: null,
    astronautStatus: 'Active',
  },
  {
    personId: 2,
    name: 'jane roe',
    currentRank: 'COL',
    currentDutyTitle: 'RETIRED',
    careerStartDate: '2010-01-01',
    careerEndDate: '2020-01-01',
    astronautStatus: 'Retired',
  },
  {
    personId: 3,
    name: 'Richard Roe',
    currentRank: null,
    currentDutyTitle: null,
    careerStartDate: null,
    careerEndDate: null,
    astronautStatus: 'None',
  },
];

describe('PeoplePage', () => {
  let harness: RouterTestingHarness;
  let controller: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'people', component: PeoplePage },
          { path: 'people/:name', component: PersonPage },
        ]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  async function open(url = '/people', people: PersonAstronaut[] | null = FIXTURE) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    el = harness.routeNativeElement as HTMLElement;
    if (people) {
      respond(people);
      await harness.fixture.whenStable();
    }
  }

  function respond(people: PersonAstronaut[]) {
    controller
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/Person'))
      .flush({ success: true, message: 'Successful', responseCode: 200, people });
  }

  /** Answers the person page's duties request (the real page is routed to). */
  function respondDuties(person: PersonAstronaut) {
    controller
      .expectOne((r) => r.method === 'GET' && r.url.includes('/AstronautDuty/'))
      .flush({
        success: true,
        message: 'Successful',
        responseCode: 200,
        person,
        astronautDuties: [],
      });
  }

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function names(): string[] {
    return Array.from(el.querySelectorAll('.card .name')).map((n) => n.textContent!.trim());
  }

  async function type(value: string) {
    const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(label: string, value: string) {
    const select = labelled<HTMLSelectElement>(label);
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  function labelled<T extends HTMLElement>(label: string): T {
    const field = Array.from(el.querySelectorAll('mat-form-field')).find((f) =>
      f.querySelector('label')?.textContent?.includes(label),
    );
    return field!.querySelector('input, select') as T;
  }

  it('shows a loading skeleton, then renders a card per person from the fixture', async () => {
    await open('/people', null);
    expect(el.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(TestBed.inject(StatusAnnouncer).message()).toContain('Loading people');
    expect(el.querySelector('[role="status"]')).toBeNull();
    respond(FIXTURE);
    await settle();
    expect(TestBed.inject(StatusAnnouncer).message()).toBe('Showing 3 of 3 people.');

    expect(el.querySelector('.skeleton')).toBeNull();
    expect(names()).toEqual(['jane roe', 'John Doe', 'Richard Roe']);
    const john = Array.from(el.querySelectorAll('.card')).find((c) =>
      c.textContent!.includes('John Doe'),
    )!;
    expect(john.textContent).toContain('1LT');
    expect(john.textContent).toContain('Commander');
    expect(el.querySelector('.count')?.textContent).toContain('Showing 3 of 3 people');
  });

  it('shows status badges with text, not only color', async () => {
    await open();
    const badges = Array.from(el.querySelectorAll('.badge')).map((b) => b.textContent!.trim());
    expect(badges.some((b) => b.includes('Active'))).toBe(true);
    expect(badges.some((b) => b.includes('Retired'))).toBe(true);
    expect(badges.some((b) => b.includes('Not an astronaut'))).toBe(true);
    for (const icon of Array.from(el.querySelectorAll('.badge mat-icon'))) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('search narrows results case-insensitively and writes q to the URL', async () => {
    await open();
    await type('  ROE ');
    expect(names()).toEqual(['jane roe', 'Richard Roe']);
    expect(el.querySelector('.count')?.textContent).toContain('Showing 2 of 3 people');
    expect(TestBed.inject(Router).url).toBe('/people?q=%20%20ROE%20');

    await type('doe');
    expect(names()).toEqual(['John Doe']);
  });

  it('status filter narrows results and writes status to the URL', async () => {
    await open();
    await choose('Status', 'retired');
    expect(names()).toEqual(['jane roe']);
    expect(TestBed.inject(Router).url).toBe('/people?status=retired');

    await choose('Status', 'none');
    expect(names()).toEqual(['Richard Roe']);

    await choose('Status', 'all');
    expect(names().length).toBe(3);
    expect(TestBed.inject(Router).url).toBe('/people');
  });

  it('search and status filter combine', async () => {
    await open();
    await type('roe');
    await choose('Status', 'active');
    expect(names()).toEqual([]);
    expect(el.querySelector('h2')?.textContent).toContain('No matches');
  });

  it('sorts by name ascending and descending, ignoring case', async () => {
    await open();
    expect(names()).toEqual(['jane roe', 'John Doe', 'Richard Roe']);
    await choose('Sort', 'name-desc');
    expect(names()).toEqual(['Richard Roe', 'John Doe', 'jane roe']);
    expect(TestBed.inject(Router).url).toBe('/people?sort=name-desc');
    await choose('Sort', 'name-asc');
    expect(names()).toEqual(['jane roe', 'John Doe', 'Richard Roe']);
  });

  it('restores state from query params and shows the controls selected', async () => {
    await open('/people?q=roe&status=none&sort=name-desc');
    expect(names()).toEqual(['Richard Roe']);
    expect(labelled<HTMLInputElement>('Search').value).toBe('roe');
    expect(labelled<HTMLSelectElement>('Status').value).toBe('none');
    expect(labelled<HTMLSelectElement>('Sort').value).toBe('name-desc');
  });

  it('ignores invalid query params', async () => {
    await open('/people?status=bogus&sort=sideways');
    expect(names().length).toBe(3);
    expect(labelled<HTMLSelectElement>('Status').value).toBe('all');
    expect(labelled<HTMLSelectElement>('Sort').value).toBe('name-asc');
  });

  it('"no matches" offers to clear the search and filter', async () => {
    await open();
    await type('zzz');
    expect(el.querySelector('.notice h2')?.textContent).toContain('No matches');
    el.querySelector<HTMLButtonElement>('.notice button')!.click();
    await settle();
    expect(names().length).toBe(3);
    expect(TestBed.inject(Router).url).toBe('/people');
  });

  describe('empty state', () => {
    it('says "No people yet" and offers an Add person button that is blocked, with its hint, until an actor is set', async () => {
      await open('/people', []);
      expect(el.querySelector('h2')?.textContent).toContain('No people yet');
      expect(el.querySelector('.cards')).toBeNull();
      expect(el.querySelector('form')).toBeNull();

      const add = el.querySelector<HTMLButtonElement>('.notice button')!;
      expect(add.textContent).toContain('Add person');
      expect(add.getAttribute('aria-disabled')).toBe('true');
      expect(add.disabled).toBe(false);
      const hint = el.querySelector(`#${add.getAttribute('aria-describedby')}`)!;
      expect(hint.textContent).toContain(TestBed.inject(ActorService).hint);
    });

    it('offers a working Add person button, and no hint, once a name is set', async () => {
      TestBed.inject(ActorService).setActor('Ada');
      await open('/people', []);
      const add = el.querySelector<HTMLButtonElement>('.notice button')!;
      expect(add.getAttribute('aria-disabled')).toBeNull();
      expect(add.getAttribute('aria-describedby')).toBeNull();
      expect(el.querySelector('app-actor-hint')?.textContent?.trim()).toBe('');
    });
  });

  describe('error state', () => {
    it('shows the API message and retries', async () => {
      await open('/people', null);
      controller
        .expectOne((r) => r.url.endsWith('/Person'))
        .flush(
          { success: false, message: 'Database is down.', responseCode: 500 },
          { status: 500, statusText: 'Server Error' },
        );
      await settle();

      const alert = el.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('Database is down.');
      expect(el.querySelector('.cards')).toBeNull();

      Array.from(alert.querySelectorAll('button'))
        .find((b) => b.textContent!.includes('Retry'))!
        .click();
      await settle();
      expect(el.querySelector('.skeleton')).not.toBeNull();
      respond(FIXTURE);
      await settle();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(names().length).toBe(3);
    });

    it('shows the unreachable message for a network failure', async () => {
      await open('/people', null);
      controller.expectOne((r) => r.url.endsWith('/Person')).error(new ProgressEvent('error'));
      await settle();
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    });
  });

  describe('keyboard and accessibility basics', () => {
    it('labels every control and gives each person a focusable link', async () => {
      await open();
      for (const label of ['Search', 'Status', 'Sort']) {
        const control = labelled<HTMLElement>(label);
        const id = control.getAttribute('id')!;
        const labelEl = el.querySelector(`label[for="${id}"]`);
        expect(labelEl?.textContent).toContain(label);
      }

      const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('.card a'));
      expect(links.length).toBe(3);
      for (const link of links) {
        expect(link.tabIndex).toBe(0);
        expect(link.getAttribute('href')).toMatch(/^\/people\/.+/);
      }
      expect(el.querySelector('ul.cards')?.getAttribute('aria-label')).toBe('People');
      expect(el.querySelector('form')?.getAttribute('role')).toBe('search');
      expect(el.querySelector('h1')?.textContent).toBe('People');
    });
  });

  describe('selecting a person', () => {
    it('links to /people/:name with the name URL-encoded and navigates there', async () => {
      await open();
      const link = Array.from(el.querySelectorAll<HTMLAnchorElement>('.card a')).find((a) =>
        a.textContent!.includes('John Doe'),
      )!;
      expect(link.getAttribute('href')).toBe('/people/John%20Doe');
      link.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe('/people/John%20Doe');
      respondDuties(FIXTURE[0]);
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('John Doe');
    });

    it('encodes reserved characters and the back link restores the list state', async () => {
      await open('/people?q=o&status=active&sort=name-desc', [{ ...FIXTURE[0], name: 'A/B? Doe' }]);
      expect(TestBed.inject(PeopleListState).queryParams()).toEqual({
        q: 'o',
        status: 'active',
        sort: 'name-desc',
      });
      const link = el.querySelector<HTMLAnchorElement>('.card a')!;
      expect(link.getAttribute('href')).toBe('/people/A%2FB%3F%20Doe');
      link.click();
      await harness.fixture.whenStable();
      respondDuties({ ...FIXTURE[0], name: 'A/B? Doe' });
      await harness.fixture.whenStable();
      harness.detectChanges();
      const back = (harness.routeNativeElement as HTMLElement).querySelector('a')!;
      expect(back.getAttribute('href')).toBe('/people?q=o&status=active&sort=name-desc');
    });
  });
});
