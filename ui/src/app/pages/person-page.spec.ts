import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { errorInterceptor } from '../api/error.interceptor';
import type { AstronautDuty, PersonAstronaut } from '../api/models';
import { formatDate } from '../shared/dates';
import { PeopleListState } from './people-list-state';
import { PeoplePage } from './people-page';
import { PersonPage } from './person-page';

const duty = (id: number, over: Partial<AstronautDuty>): AstronautDuty => ({
  id,
  personId: 1,
  rank: '1LT',
  dutyTitle: 'Pilot',
  dutyStartDate: '2020-01-15',
  dutyEndDate: null,
  reason: null,
  ...over,
});

const ACTIVE: PersonAstronaut = {
  personId: 1,
  name: 'John Doe',
  currentRank: 'CPT',
  currentDutyTitle: 'Commander',
  careerStartDate: '2020-01-15',
  careerEndDate: null,
  astronautStatus: 'Active',
};

// Newest first, like the API: an open current duty, a corrected duty with a reason, and the first duty.
const ACTIVE_DUTIES: AstronautDuty[] = [
  duty(3, { rank: 'CPT', dutyTitle: 'Commander', dutyStartDate: '2023-05-01' }),
  duty(2, {
    dutyTitle: 'Pilot',
    dutyStartDate: '2021-09-10',
    dutyEndDate: '2023-04-30',
    reason: 'Start date was recorded wrongly and corrected.',
  }),
  duty(1, {
    dutyTitle: 'Mission Specialist',
    dutyStartDate: '2020-01-15',
    dutyEndDate: '2021-09-09',
  }),
];

const RETIRED: PersonAstronaut = {
  personId: 2,
  name: 'Jane Roe',
  currentRank: 'COL',
  currentDutyTitle: 'RETIRED',
  careerStartDate: '1998-03-02',
  careerEndDate: '2019-12-31',
  astronautStatus: 'Retired',
};

const RETIRED_DUTIES: AstronautDuty[] = [
  duty(6, { personId: 2, rank: 'COL', dutyTitle: 'RETIRED', dutyStartDate: '2020-01-01' }),
  duty(5, {
    personId: 2,
    rank: 'COL',
    dutyTitle: 'Commander',
    dutyStartDate: '2009-06-15',
    dutyEndDate: '2019-12-31',
  }),
];

const NONE: PersonAstronaut = {
  personId: 3,
  name: 'Richard Roe',
  currentRank: null,
  currentDutyTitle: null,
  careerStartDate: null,
  careerEndDate: null,
  astronautStatus: 'None',
};

describe('PersonPage', () => {
  let harness: RouterTestingHarness;
  let controller: HttpTestingController;
  let el: HTMLElement;

  beforeEach(() => {
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

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    el = harness.routeNativeElement as HTMLElement;
  }

  const dutiesRequest = () =>
    controller.expectOne((r) => r.method === 'GET' && r.url.includes('/AstronautDuty/'));

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function show(person: PersonAstronaut, duties: AstronautDuty[], url?: string) {
    await open(url ?? `/people/${encodeURIComponent(person.name)}`);
    dutiesRequest().flush({
      success: true,
      message: 'Successful',
      responseCode: 200,
      person,
      astronautDuties: duties,
    });
    await settle();
  }

  const entries = () => Array.from(el.querySelectorAll<HTMLElement>('ol.timeline > li'));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** The value shown for a header fact, e.g. fact('Career end'). */
  const fact = (label: string) =>
    text(
      Array.from(el.querySelectorAll('.facts > div'))
        .find((row) => text(row.querySelector('dt')) === label)
        ?.querySelector('dd') ?? null,
    );

  describe('request', () => {
    it('calls GET /AstronautDuty/{name} with the name URL-encoded', async () => {
      await open('/people/John%20Doe');
      const request = dutiesRequest();
      expect(request.request.url).toMatch(/\/AstronautDuty\/John%20Doe$/);
      request.flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
    });

    it('keeps spaces, slashes, question marks and percent signs intact end to end', async () => {
      const name = 'A/B? 100% Doe';
      await open(`/people/${encodeURIComponent(name)}`);
      const request = dutiesRequest();
      expect(request.request.url).toMatch(/\/AstronautDuty\/A%2FB%3F%20100%25%20Doe$/);
      request.flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(text(el.querySelector('h1'))).toBe(name);
    });

    it('loads the new person when the route param changes', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      await TestBed.inject(Router).navigateByUrl('/people/Jane%20Roe');
      harness.detectChanges();
      dutiesRequest().flush({
        success: true,
        message: 'Successful',
        responseCode: 200,
        person: RETIRED,
        astronautDuties: RETIRED_DUTIES,
      });
      await settle();
      expect(text(el.querySelector('h1'))).toBe('Jane Roe');
      expect(entries().length).toBe(2);
    });
  });

  describe('loading', () => {
    it('shows a skeleton and the name from the route while loading', async () => {
      await open('/people/John%20Doe');
      expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
      expect(el.querySelector('.skeleton-list')).not.toBeNull();
      expect(text(el.querySelector('[role="status"]'))).toBe('Loading duties…');
      expect(text(el.querySelector('h1'))).toBe('John Doe');
      dutiesRequest().flush({}, { status: 404, statusText: 'Not Found' });
      await settle();
    });
  });

  describe('header', () => {
    it('shows name, status badge, current rank and title, career start and end', async () => {
      await show(RETIRED, RETIRED_DUTIES);
      expect(text(el.querySelector('h1'))).toBe('Jane Roe');
      expect(text(el.querySelector('app-status-badge'))).toBe('military_tech Retired');
      expect(fact('Current rank')).toBe('COL');
      expect(fact('Current duty title')).toBe('RETIRED');
      expect(fact('Career start')).toBe(formatDate('1998-03-02'));
      expect(fact('Career end')).toBe(formatDate('2019-12-31'));
      expect(fact('Career length')).toBe('21 years, 9 months');
    });

    it('shows "Present" as career end and a running career length for an active person', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      expect(text(el.querySelector('app-status-badge'))).toContain('Active');
      expect(fact('Career end')).toBe('Present');
      expect(fact('Career length')).toMatch(/^\d+ years?(, \d+ months?)? so far$/);
    });

    it('shows nothing misleading for someone who is not an astronaut', async () => {
      await show(NONE, []);
      expect(text(el.querySelector('app-status-badge'))).toContain('Not an astronaut');
      expect(fact('Current rank')).toBe('Not assigned');
      expect(fact('Career start')).toBe('Not applicable');
      expect(fact('Career end')).toBe('Not applicable');
      expect(fact('Career length')).toBe('');
    });
  });

  describe('timeline', () => {
    it('renders the duties, newest first, as a semantic ordered list', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      const list = el.querySelector('ol.timeline')!;
      expect(list.getAttribute('aria-labelledby')).toBe('timeline-heading');
      expect(text(el.querySelector('#timeline-heading'))).toBe('Duty timeline');
      const titles = entries().map((li) => text(li.querySelector('.entry-title')));
      expect(titles).toEqual(['CPT Commander', '1LT Pilot', '1LT Mission Specialist']);
    });

    it('orders by start date even when the API sends them oldest first', async () => {
      await show(ACTIVE, [...ACTIVE_DUTIES].reverse());
      const titles = entries().map((li) => text(li.querySelector('.entry-title')));
      expect(titles[0]).toBe('CPT Commander');
      expect(titles[2]).toBe('1LT Mission Specialist');
    });

    it('formats each date with the browser locale and shows "Present" for the open duty', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      const [open, middle] = entries();
      expect(text(open.querySelector('.dates'))).toContain(formatDate('2023-05-01'));
      expect(text(open.querySelector('.dates'))).toContain('Present');
      expect(text(middle.querySelector('.dates'))).toContain(formatDate('2021-09-10'));
      expect(text(middle.querySelector('.dates'))).toContain(formatDate('2023-04-30'));
      expect(middle.querySelector('.dates')?.textContent).not.toContain('Present');
      expect(middle.querySelector('time')?.getAttribute('datetime')).toBe('2021-09-10');
    });

    it('highlights the current duty with text and aria-current, not color alone', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      const [current, past] = entries();
      expect(current.classList).toContain('entry-current');
      expect(current.getAttribute('aria-current')).toBe('true');
      expect(text(current.querySelector('.chip'))).toContain('Current');
      expect(past.classList).toContain('entry-past');
      expect(past.getAttribute('aria-current')).toBeNull();
      expect(past.querySelector('.chip')).toBeNull();
      expect(el.querySelectorAll('.entry-current').length).toBe(1);
    });

    it('styles the RETIRED entry distinctly, with a "Retired" label', async () => {
      await show(RETIRED, RETIRED_DUTIES);
      const [retired, before] = entries();
      expect(retired.classList).toContain('entry-retired');
      expect(retired.classList).not.toContain('entry-current');
      expect(text(retired.querySelector('.chip'))).toContain('Retired');
      expect(text(retired.querySelector('.dates'))).toContain('Present');
      expect(before.classList).toContain('entry-past');
    });

    it('styles a RETIRED entry in the middle of the timeline (returned from retirement)', async () => {
      const ada = { ...ACTIVE, personId: 4, name: 'Ada Stone' };
      await show(ada, [
        duty(10, { rank: 'MAJ', dutyStartDate: '2018-03-01', reason: 'Returned from retirement' }),
        duty(9, {
          rank: 'MAJ',
          dutyTitle: 'retired',
          dutyStartDate: '2015-07-01',
          dutyEndDate: '2018-02-28',
        }),
        duty(7, { dutyStartDate: '2005-04-11', dutyEndDate: '2015-06-30' }),
      ]);
      const kinds = entries().map((li) => li.className);
      expect(kinds[0]).toContain('entry-current');
      expect(kinds[1]).toContain('entry-retired');
      expect(kinds[2]).toContain('entry-past');
      expect(text(entries()[1].querySelector('.dates'))).toContain(formatDate('2018-02-28'));
    });

    it('shows the reason only when there is one', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      const reasons = entries().map((li) => li.querySelector('.reason'));
      expect(reasons[0]).toBeNull();
      expect(text(reasons[1])).toBe('Reason: Start date was recorded wrongly and corrected.');
      expect(reasons[2]).toBeNull();
      expect(el.querySelectorAll('.reason').length).toBe(1);
    });

    it('does not show a reason for a blank reason', async () => {
      await show(ACTIVE, [duty(1, { reason: '' })]);
      expect(el.querySelector('.reason')).toBeNull();
    });
  });

  describe('not found', () => {
    it('shows "Person not found" with a link back for a 404', async () => {
      await open('/people/Nobody');
      dutiesRequest().flush(
        { success: false, message: 'Person not found.', responseCode: 404 },
        { status: 404, statusText: 'Not Found' },
      );
      await settle();
      expect(text(el.querySelector('.notice h2'))).toBe('Person not found');
      expect(text(el.querySelector('.notice'))).toContain('“Nobody”');
      expect(el.querySelector('ol')).toBeNull();
      const link = el.querySelector<HTMLAnchorElement>('.notice a')!;
      expect(link.getAttribute('href')).toBe('/people');
      expect(el.querySelector('.notice button')).toBeNull();
    });
  });

  describe('empty', () => {
    it('shows "No astronaut assignments" for a person without duties', async () => {
      await show(NONE, []);
      expect(text(el.querySelector('.notice h2'))).toBe('No astronaut assignments');
      expect(el.querySelector('ol')).toBeNull();
    });
  });

  describe('error', () => {
    it('shows the API message and retries', async () => {
      await open('/people/John%20Doe');
      dutiesRequest().flush(
        { success: false, message: 'Storage is unavailable.', responseCode: 500 },
        { status: 500, statusText: 'Server Error' },
      );
      await settle();
      const panel = el.querySelector('.notice[role="alert"]')!;
      expect(text(panel.querySelector('h2'))).toBe('Could not load duties');
      expect(text(panel.querySelector('.message'))).toBe('Storage is unavailable.');
      expect(text(el.querySelector('.notice'))).not.toContain('Person not found');

      el.querySelector<HTMLButtonElement>('.notice button')!.click();
      await settle();
      expect(el.querySelector('.skeleton-list')).not.toBeNull();
      expect(document.activeElement).toBe(el.querySelector('h1'));
      dutiesRequest().flush({
        success: true,
        message: 'Successful',
        responseCode: 200,
        person: ACTIVE,
        astronautDuties: ACTIVE_DUTIES,
      });
      await settle();
      expect(entries().length).toBe(3);
      expect(el.querySelector('.notice')).toBeNull();
    });

    it('explains an unreachable API', async () => {
      await open('/people/John%20Doe');
      dutiesRequest().error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(text(el.querySelector('.message'))).toContain('API unreachable');
    });
  });

  describe('navigation and focus', () => {
    it('focuses the page heading after navigating to the page', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      expect(document.activeElement).toBe(el.querySelector('h1'));
      expect(el.querySelector('h1')?.getAttribute('tabindex')).toBe('-1');
    });

    it('has one h1, then h2 for the timeline and h3 per duty', async () => {
      await show(ACTIVE, ACTIVE_DUTIES);
      expect(el.querySelectorAll('h1').length).toBe(1);
      expect(el.querySelectorAll('h2').length).toBe(1);
      expect(el.querySelectorAll('h3').length).toBe(3);
    });

    it('links back to the list with the remembered search and filter', async () => {
      TestBed.inject(PeopleListState).remember({ q: 'roe', status: 'retired', sort: 'name-desc' });
      await show(RETIRED, RETIRED_DUTIES);
      const back = el.querySelector<HTMLAnchorElement>('a.back')!;
      expect(text(back)).toContain('Back to People');
      expect(back.getAttribute('href')).toBe('/people?q=roe&status=retired&sort=name-desc');
    });

    it('links back to the plain list when nothing was remembered', async () => {
      await show(RETIRED, RETIRED_DUTIES);
      expect(el.querySelector('a.back')?.getAttribute('href')).toBe('/people');
    });
  });
});
