import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { errorInterceptor } from '../api/error.interceptor';
import type { AstronautDuty, PersonAstronaut } from '../api/models';
import { actorInterceptor } from '../core/actor.interceptor';
import { ActorService } from '../core/actor.service';
import { StatusAnnouncer } from '../core/status-announcer';
import { todayUtcIsoDate } from '../shared/dates';
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
const ACTIVE_DUTIES = [
  duty(2, { rank: 'CPT', dutyTitle: 'Commander', dutyStartDate: '2023-05-01' }),
  duty(1, { dutyTitle: 'Pilot', dutyStartDate: '2020-01-15', dutyEndDate: '2023-04-30' }),
];

const RETIRED: PersonAstronaut = {
  ...ACTIVE,
  personId: 2,
  name: 'Jane Roe',
  currentRank: 'COL',
  currentDutyTitle: 'RETIRED',
  careerEndDate: '2019-12-31',
  astronautStatus: 'Retired',
};
const RETIRED_DUTIES = [
  duty(4, { personId: 2, rank: 'COL', dutyTitle: 'RETIRED', dutyStartDate: '2020-01-01' }),
  duty(3, {
    personId: 2,
    rank: 'COL',
    dutyTitle: 'Commander',
    dutyStartDate: '2010-01-01',
    dutyEndDate: '2019-12-31',
  }),
];

const ok = (extra: object = {}) => ({
  success: true,
  message: 'Successful',
  responseCode: 200,
  ...extra,
});
const failure = (
  status: number,
  message: string,
  errors?: { field: string; message: string }[],
) => ({
  body: { success: false, message, responseCode: status, ...(errors ? { errors } : {}) },
  init: { status, statusText: 'Error' },
});

describe('Person page write forms (rename and add duty)', () => {
  let harness: RouterTestingHarness;
  let controller: HttpTestingController;
  let router: Router;
  let el: HTMLElement;
  const today = todayUtcIsoDate();

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'people', component: PeoplePage },
          { path: 'people/:name', component: PersonPage },
        ]),
        provideHttpClient(withInterceptors([actorInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => controller.verify());

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  const dutiesRequest = () =>
    controller.expectOne((r) => r.method === 'GET' && r.url.includes('/AstronautDuty/'));

  async function show(
    person: PersonAstronaut,
    duties: AstronautDuty[],
    options: { actor?: string | null } = {},
  ) {
    const { actor = 'Ada' } = options;
    if (actor) {
      TestBed.inject(ActorService).setActor(actor);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/people/${encodeURIComponent(person.name)}`);
    el = harness.routeNativeElement as HTMLElement;
    dutiesRequest().flush(ok({ person, astronautDuties: duties }));
    await settle();
  }

  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(label),
    )!;
  const field = (selector: string) =>
    el.querySelector<HTMLInputElement & HTMLTextAreaElement>(selector)!;
  async function fill(selector: string, value: string) {
    const control = field(selector);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await settle();
  }
  const errors = () =>
    Array.from(el.querySelectorAll('mat-error')).map((e) => e.textContent!.trim());
  const alertText = () => el.querySelector('form [role="alert"]')?.textContent?.trim() ?? null;
  const banner = () => el.querySelector<HTMLElement>('[role="region"]');
  const writes = (method: string) =>
    controller.match((r) => r.method === method && !r.url.includes('/AstronautDuty/John'));

  describe('without an actor', () => {
    it('blocks Rename and Add duty with a visible hint and does not open the forms', async () => {
      await show(ACTIVE, ACTIVE_DUTIES, { actor: null });
      for (const label of ['Rename', 'Add duty']) {
        const b = button(label);
        expect(b.disabled).toBe(false);
        expect(b.getAttribute('aria-disabled')).toBe('true');
        expect(el.querySelector(`#${b.getAttribute('aria-describedby')}`)?.textContent).toContain(
          TestBed.inject(ActorService).hint,
        );
        b.click();
      }
      await settle();
      expect(el.querySelector('form')).toBeNull();
    });
  });

  describe('Rename', () => {
    async function openRename(person = ACTIVE, duties = ACTIVE_DUTIES) {
      await show(person, duties);
      button('Rename').click();
      await settle();
    }
    const newName = () => field('input[formControlName="newName"]');
    const submit = () => el.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    const put = () => controller.expectOne((r) => r.method === 'PUT');

    it('opens an inline form prefilled with the current name and focuses it', async () => {
      await openRename();
      expect(newName().value).toBe('John Doe');
      expect(document.activeElement).toBe(newName());
      expect(button('Rename').getAttribute('aria-expanded')).toBe('true');
    });

    it('sends no request when the trimmed name is unchanged, and says so', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', '  John Doe  ');
      submit().click();
      await settle();
      expect(controller.match((r) => r.method === 'PUT')).toHaveLength(0);
      expect(el.querySelector('form [role="status"]')).toBeNull();
      expect(el.querySelector('.unchanged')?.textContent).toContain('already');
      expect(TestBed.inject(StatusAnnouncer).message()).toContain('already this person');
    });

    it.each([
      ['empty', '', 'The new name is required.'],
      ['blank', '   ', 'The new name is required.'],
      ['over 200 characters', 'x'.repeat(201), 'The new name must be at most 200 characters.'],
    ])('validates a %s name without a request', async (_label, value, message) => {
      await openRename();
      await fill('input[formControlName="newName"]', value);
      submit().click();
      await settle();
      expect(errors()).toEqual([message]);
      expect(controller.match((r) => r.method === 'PUT')).toHaveLength(0);
    });

    it('renames with the trimmed name, then replaces the URL with the new name and reloads', async () => {
      await openRename();
      const navigate = vi.spyOn(router, 'navigate');
      await fill('input[formControlName="newName"]', '  Johnny Doe ');
      submit().click();
      await settle();

      const request = put();
      expect(request.request.url).toMatch(/\/Person\/John%20Doe$/);
      expect(request.request.body).toEqual({ newName: 'Johnny Doe' });
      expect(request.request.headers.get('X-Actor')).toBe('Ada');
      request.flush(ok());
      await settle();

      expect(navigate).toHaveBeenCalledWith(['/people', 'Johnny Doe'], { replaceUrl: true });
      expect(router.url).toBe('/people/Johnny%20Doe');
      controller
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/AstronautDuty/Johnny%20Doe'))
        .flush(ok({ person: { ...ACTIVE, name: 'Johnny Doe' }, astronautDuties: ACTIVE_DUTIES }));
      await settle();
      expect(el.querySelector('h1')?.textContent).toContain('Johnny Doe');
      expect(el.querySelector('form')).toBeNull();
      expect(document.querySelector('.mat-mdc-snack-bar-container')?.textContent).toContain(
        'Renamed to Johnny Doe.',
      );
    });

    it('allows a change of letter case only', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'john doe');
      submit().click();
      await settle();
      const request = put();
      expect(request.request.body).toEqual({ newName: 'john doe' });
      request.flush(ok());
      await settle();
      expect(router.url).toBe('/people/john%20doe');
      controller
        .expectOne((r) => r.method === 'GET' && r.url.endsWith('/AstronautDuty/john%20doe'))
        .flush(ok({ person: { ...ACTIVE, name: 'john doe' }, astronautDuties: ACTIVE_DUTIES }));
      await settle();
    });

    it('reloads in place when the URL already has the new name (case-insensitive route)', async () => {
      await show({ ...ACTIVE, name: 'John Doe' }, ACTIVE_DUTIES);
      // The route name differs from the canonical name only by case.
      await router.navigateByUrl('/people/john%20doe');
      await settle();
      dutiesRequest().flush(ok({ person: ACTIVE, astronautDuties: ACTIVE_DUTIES }));
      await settle();
      button('Rename').click();
      await settle();
      await fill('input[formControlName="newName"]', 'john doe');
      submit().click();
      await settle();
      put().flush(ok());
      await settle();
      controller
        .expectOne((r) => r.method === 'GET' && r.url.includes('/AstronautDuty/'))
        .flush(ok({ person: { ...ACTIVE, name: 'john doe' }, astronautDuties: ACTIVE_DUTIES }));
      await settle();
      expect(el.querySelector('h1')?.textContent).toContain('john doe');
    });

    it('shows a 409 on the new name field and keeps the form open', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'Jane Roe');
      submit().click();
      await settle();
      const { body, init } = failure(409, 'A person with this name already exists.');
      put().flush(body, init);
      await settle();
      expect(errors()).toEqual(['A person with this name already exists.']);
      expect(alertText()).toBeNull();
      expect(router.url).toBe('/people/John%20Doe');
    });

    it('shows a 404 (the person no longer exists) as a dismissible form message', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'Jon Doe');
      submit().click();
      await settle();
      const { body, init } = failure(404, 'Person not found.');
      put().flush(body, init);
      await settle();
      expect(alertText()).toContain('Person not found.');
      el.querySelector<HTMLButtonElement>('form [role="alert"] button')!.click();
      await settle();
      expect(alertText()).toBeNull();
    });

    it('maps a 400 errors[] entry for newName onto the field', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'Jon Doe');
      submit().click();
      await settle();
      const { body, init } = failure(400, 'Validation failed.', [
        { field: 'newName', message: 'The new name must be at most 200 characters.' },
      ]);
      put().flush(body, init);
      await settle();
      expect(errors()).toEqual(['The new name must be at most 200 characters.']);
    });

    it('does not double submit', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'Jon Doe');
      submit().click();
      submit().click();
      await settle();
      const requests = controller.match((r) => r.method === 'PUT');
      expect(requests).toHaveLength(1);
      expect(submit().getAttribute('aria-disabled')).toBe('true');
      requests[0].flush(ok());
      await settle();
      controller.match((r) => r.url.includes('/AstronautDuty/'));
    });

    it('closes on Cancel and returns focus to the Rename button', async () => {
      await openRename();
      button('Cancel').click();
      await settle();
      expect(el.querySelector('form')).toBeNull();
      expect(document.activeElement).toBe(button('Rename'));
    });

    it('closes on Escape while nothing was typed, but keeps typed text and explains how to discard it', async () => {
      await openRename();
      const form = () => el.querySelector('form')!;
      form().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(el.querySelector('form')).toBeNull();

      button('Rename').click();
      await settle();
      await fill('input[formControlName="newName"]', 'Jon Doe');
      form().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(el.querySelector('form')).not.toBeNull();
      expect(newName().value).toBe('Jon Doe');
      expect(el.querySelector('.acts-discard-hint')?.textContent).toContain('unsaved changes');
      expect(TestBed.inject(StatusAnnouncer).message()).toContain('unsaved changes');

      button('Cancel').click();
      await settle();
      expect(el.querySelector('form')).toBeNull();
    });

    it('cannot be closed while the request is in flight, so a success is never lost', async () => {
      await openRename();
      await fill('input[formControlName="newName"]', 'Jon Doe');
      submit().click();
      await settle();
      button('Cancel').click();
      el.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      button('Rename').click();
      await settle();
      expect(el.querySelector('form')).not.toBeNull();
      controller.expectOne((r) => r.method === 'PUT').flush(ok());
      await settle();
      expect(el.querySelector('form')).toBeNull();
      controller.match((r) => r.url.includes('/AstronautDuty/'));
    });
  });

  describe('Add duty', () => {
    async function openDuty(person = ACTIVE, duties = ACTIVE_DUTIES) {
      await show(person, duties);
      button('Add duty').click();
      await settle();
    }
    const submit = () => el.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    const post = () =>
      controller.expectOne((r) => r.method === 'POST' && r.url.endsWith('/AstronautDuty'));
    const reasonLabel = () =>
      Array.from(el.querySelectorAll('mat-label'))
        .find((l) => l.textContent!.includes('Reason'))!
        .textContent!.trim();
    const setDate = (value: string) => fill('input[formControlName="dutyStartDate"]', value);
    const setRank = (value: string) => fill('input[formControlName="rank"]', value);
    const setTitle = (value: string) => fill('input[formControlName="dutyTitle"]', value);
    const setReason = (value: string) => fill('textarea[formControlName="reason"]', value);

    it('opens the form with today (UTC) as the start date and an optional reason', async () => {
      await openDuty();
      expect(field('input[formControlName="dutyStartDate"]').value).toBe(today);
      expect(field('input[formControlName="dutyStartDate"]').type).toBe('date');
      expect(reasonLabel()).toContain('(optional)');
      expect(banner()).toBeNull();
      expect(button('Add duty').getAttribute('aria-expanded')).toBe('true');
    });

    describe('client-side validation per the contract', () => {
      it('requires rank, title and start date', async () => {
        await openDuty();
        await setDate('');
        submit().click();
        await settle();
        expect(errors()).toEqual([
          'The rank is required.',
          'The duty title is required.',
          'The start date is required.',
        ]);
        expect(writes('POST')).toHaveLength(0);
        expect(document.activeElement).toBe(field('input[formControlName="rank"]'));
      });

      it('trims rank and title, and limits them to 100 characters', async () => {
        await openDuty();
        await setRank('   ');
        await setTitle('x'.repeat(101));
        submit().click();
        await settle();
        expect(errors()).toEqual([
          'The rank is required.',
          'The duty title must be at most 100 characters.',
        ]);
        expect(writes('POST')).toHaveLength(0);
      });

      it('limits the reason to 500 characters (after trimming)', async () => {
        await openDuty();
        await setRank('CPT');
        await setTitle('Pilot');
        await setReason('y'.repeat(501));
        submit().click();
        await settle();
        expect(errors()).toEqual(['The reason must be at most 500 characters.']);
        expect(writes('POST')).toHaveLength(0);

        await setReason(`  ${'y'.repeat(500)}  `);
        submit().click();
        await settle();
        expect(post().request.body.reason).toBe('y'.repeat(500));
      });

      it('flags a start date that an existing duty already uses (the server would answer 409)', async () => {
        await openDuty();
        await setRank('CPT');
        await setTitle('Pilot');
        await setDate('2023-05-01');
        submit().click();
        await settle();
        expect(errors().join(' ')).toContain('A duty already starts on May 1, 2023');
        expect(writes('POST')).toHaveLength(0);
      });
    });

    it('adds a normal duty: trimmed values, today as the date, no reason, X-Actor, then refreshes the timeline', async () => {
      await openDuty();
      await setRank('  MAJ ');
      await setTitle(' Flight Engineer ');
      submit().click();
      await settle();

      const request = post();
      expect(request.request.body).toEqual({
        name: 'John Doe',
        rank: 'MAJ',
        dutyTitle: 'Flight Engineer',
        dutyStartDate: today,
      });
      expect(request.request.headers.get('X-Actor')).toBe('Ada');
      request.flush(ok({ id: 11 }));
      await settle();

      dutiesRequest().flush(
        ok({
          person: { ...ACTIVE, currentRank: 'MAJ', currentDutyTitle: 'Flight Engineer' },
          astronautDuties: [
            duty(11, { rank: 'MAJ', dutyTitle: 'Flight Engineer', dutyStartDate: today }),
            ...ACTIVE_DUTIES,
          ],
        }),
      );
      await settle();
      expect(el.querySelectorAll('ol.timeline > li')).toHaveLength(3);
      expect(el.querySelector('form')).toBeNull();
      expect(document.querySelector('.mat-mdc-snack-bar-container')?.textContent).toContain(
        'Duty added.',
      );
      expect(
        document
          .querySelector('.mat-mdc-snack-bar-container [aria-live]')
          ?.getAttribute('aria-live'),
      ).toBe('polite');
    });

    describe('the reason field and its banner', () => {
      it('is required with the "Correcting an earlier date" banner when before the latest duty start', async () => {
        await openDuty();
        await setRank('CPT');
        await setTitle('Pilot');
        await setDate('2022-01-01');
        expect(banner()?.textContent).toContain('Correcting an earlier date');
        expect(banner()?.getAttribute('aria-labelledby')).toBeTruthy();
        expect(banner()?.querySelector('mat-icon')).toBeTruthy();
        expect(reasonLabel()).toContain('(required)');

        submit().click();
        await settle();
        expect(errors()).toEqual(['A reason is required here: see the note above.']);
        expect(writes('POST')).toHaveLength(0);

        await setReason('Start date was recorded wrongly.');
        expect(errors()).toEqual([]);
        submit().click();
        await settle();
        expect(post().request.body).toEqual({
          name: 'John Doe',
          rank: 'CPT',
          dutyTitle: 'Pilot',
          dutyStartDate: '2022-01-01',
          reason: 'Start date was recorded wrongly.',
        });
      });

      it('is required with the "Future-dated entry" banner after today (UTC)', async () => {
        await openDuty();
        await setDate('2999-01-01');
        expect(banner()?.textContent).toContain('Future-dated entry');
        expect(reasonLabel()).toContain('(required)');
        await setRank('CPT');
        await setTitle('Pilot');
        submit().click();
        await settle();
        expect(errors()).toEqual(['A reason is required here: see the note above.']);
      });

      it('is not required for today, and the banner goes away when the date is fixed', async () => {
        await openDuty();
        await setDate('2999-01-01');
        expect(banner()).not.toBeNull();
        await setDate(today);
        expect(banner()).toBeNull();
        expect(reasonLabel()).toContain('(optional)');
      });

      it('is required with the "Returning from retirement" banner when the person is retired', async () => {
        await openDuty(RETIRED, RETIRED_DUTIES);
        expect(banner()?.textContent).toContain('Returning from retirement');
        expect(reasonLabel()).toContain('(required)');
        await setRank('COL');
        await setTitle('Pilot');
        submit().click();
        await settle();
        expect(errors()).toEqual(['A reason is required here: see the note above.']);
        expect(writes('POST')).toHaveLength(0);

        await setReason('Returned from retirement.');
        submit().click();
        await settle();
        expect(post().request.body.reason).toBe('Returned from retirement.');
      });

      it('announces banner changes politely', async () => {
        await openDuty();
        expect(el.querySelector('.banner-slot')?.getAttribute('aria-live')).toBe('polite');
      });
    });

    it('fills RETIRED (and the current rank when empty) with the quick-pick', async () => {
      await openDuty();
      button('RETIRED').click();
      await settle();
      expect(field('input[formControlName="dutyTitle"]').value).toBe('RETIRED');
      expect(field('input[formControlName="rank"]').value).toBe('CPT');

      await setRank('COL');
      await setTitle('');
      button('RETIRED').click();
      await settle();
      expect(field('input[formControlName="rank"]').value).toBe('COL');
    });

    describe('server errors', () => {
      async function submitValid() {
        await openDuty();
        await setRank('CPT');
        await setTitle('Pilot');
        submit().click();
        await settle();
      }

      it('maps errors[] to rank, dutyTitle, dutyStartDate and reason', async () => {
        await submitValid();
        const { body, init } = failure(400, 'Validation failed.', [
          { field: 'rank', message: 'Rank problem.' },
          { field: 'dutyTitle', message: 'Title problem.' },
          { field: 'dutyStartDate', message: 'Date problem.' },
          { field: 'reason', message: 'Reason problem.' },
        ]);
        post().flush(body, init);
        await settle();
        expect(errors()).toEqual([
          'Rank problem.',
          'Title problem.',
          'Date problem.',
          'Reason problem.',
        ]);
        expect(alertText()).toBeNull();
        expect(submit().getAttribute('aria-disabled')).toBeNull();
      });

      it('shows the X-Actor and name errors as a form-level message', async () => {
        await submitValid();
        const { body, init } = failure(400, 'Validation failed.', [
          { field: 'X-Actor', message: 'The X-Actor header is required.' },
          { field: 'name', message: 'The name is required.' },
        ]);
        post().flush(body, init);
        await settle();
        expect(errors()).toEqual([]);
        expect(alertText()).toContain('Acting as');
        expect(alertText()).toContain('The name is required.');
      });

      it('shows the contract reason error from the server on the reason field', async () => {
        await submitValid();
        const { body, init } = failure(400, 'Validation failed.', [
          {
            field: 'reason',
            message: "A reason is required when the duty starts before the person's latest duty.",
          },
        ]);
        post().flush(body, init);
        await settle();
        expect(errors()).toEqual([
          "A reason is required when the duty starts before the person's latest duty.",
        ]);
      });

      it('shows a 409 (same start date) on the start date field', async () => {
        await submitValid();
        const { body, init } = failure(409, 'The person already has a duty starting on this date.');
        post().flush(body, init);
        await settle();
        expect(errors()).toEqual(['The person already has a duty starting on this date.']);
      });

      it('shows a 404 as a dismissible form message', async () => {
        await submitValid();
        const { body, init } = failure(404, 'Person not found.');
        post().flush(body, init);
        await settle();
        expect(alertText()).toContain('Person not found.');
        el.querySelector<HTMLButtonElement>('form [role="alert"] button')!.click();
        await settle();
        expect(alertText()).toBeNull();
      });

      it('shows an unreachable API as a dismissible message and allows a retry', async () => {
        await submitValid();
        post().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
        await settle();
        expect(alertText()).toContain('API unreachable');
        submit().click();
        await settle();
        post().flush(ok({ id: 12 }));
        await settle();
        dutiesRequest().flush(ok({ person: ACTIVE, astronautDuties: ACTIVE_DUTIES }));
      });
    });

    it('does not double submit: two quick clicks send one request', async () => {
      await openDuty();
      await setRank('CPT');
      await setTitle('Pilot');
      submit().click();
      submit().click();
      await settle();
      const requests = controller.match((r) => r.method === 'POST');
      expect(requests).toHaveLength(1);
      expect(submit().getAttribute('aria-disabled')).toBe('true');
      requests[0].flush(ok({ id: 12 }));
      await settle();
      dutiesRequest().flush(ok({ person: ACTIVE, astronautDuties: ACTIVE_DUTIES }));
    });

    it('closes on Escape and returns focus to the Add duty button', async () => {
      await openDuty();
      field('input[formControlName="rank"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();
      expect(el.querySelector('form')).toBeNull();
      expect(document.activeElement).toBe(button('Add duty'));
    });

    it('does not discard typed text on Escape: it keeps the form, says so and Cancel still closes', async () => {
      await openDuty();
      await fill('textarea[formControlName="reason"]', 'Long explanation I do not want to lose');
      const reason = field('textarea[formControlName="reason"]');
      reason.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(el.querySelector('form')).not.toBeNull();
      expect(field('textarea[formControlName="reason"]').value).toBe(
        'Long explanation I do not want to lose',
      );
      expect(el.querySelector('.acts-discard-hint')?.textContent).toContain('Cancel');
      expect(TestBed.inject(StatusAnnouncer).message()).toContain('unsaved changes');

      await fill('textarea[formControlName="reason"]', 'Long explanation I do not want to lose!');
      expect(el.querySelector('.acts-discard-hint')).toBeNull();

      button('Cancel').click();
      await settle();
      expect(el.querySelector('form')).toBeNull();
    });

    it('sends nothing when Enter or Space activates the blocked submit (no actor name)', async () => {
      await openDuty();
      await setRank('CPT');
      await setTitle('Pilot');
      TestBed.inject(ActorService).clearActor();
      await settle();
      const blocked = submit();
      expect(blocked.getAttribute('aria-disabled')).toBe('true');
      blocked.focus();
      // A browser turns Enter or Space on a focused button, and Enter inside a field, into a click on the submit button.
      for (const key of ['Enter', ' ']) {
        blocked.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        blocked.click();
      }
      field('input[formControlName="rank"]').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      blocked.click();
      await settle();
      expect(controller.match((r) => r.method === 'POST')).toHaveLength(0);
      expect(document.activeElement).toBe(blocked);
      expect(el.querySelector('form')).not.toBeNull();
    });

    it('announces how many fields need attention when the submit is rejected', async () => {
      await openDuty();
      submit().click();
      await settle();
      expect(TestBed.inject(StatusAnnouncer).message()).toBe(
        'Cannot add the duty: 2 fields need attention.',
      );
      expect(
        el.querySelector('.mat-mdc-form-field-subscript-wrapper')?.getAttribute('aria-live'),
      ).toBe('polite');
    });
  });
});
