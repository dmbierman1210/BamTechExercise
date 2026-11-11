import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { errorInterceptor } from '../api/error.interceptor';
import { actorInterceptor } from '../core/actor.interceptor';
import { ActorService } from '../core/actor.service';
import { PeoplePage } from './people-page';
import { PersonPage } from './person-page';

const PERSON = {
  personId: 1,
  name: 'John Doe',
  currentRank: 'CPT',
  currentDutyTitle: 'Commander',
  careerStartDate: '2020-01-15',
  careerEndDate: null,
  astronautStatus: 'Active',
};

describe('Add person (dialog on the People page)', () => {
  let harness: RouterTestingHarness;
  let controller: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
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
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    controller.verify();
  });

  async function settle() {
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  async function open(options: { actor?: string | null; people?: object[] } = {}) {
    const { actor = 'Ada', people = [PERSON] } = options;
    if (actor) {
      TestBed.inject(ActorService).setActor(actor);
    }
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');
    el = harness.routeNativeElement as HTMLElement;
    controller
      .expectOne((r) => r.method === 'GET' && r.url.endsWith('/Person'))
      .flush({ success: true, message: 'Successful', responseCode: 200, people });
    await settle();
  }

  const headerButton = () => el.querySelector<HTMLButtonElement>('.page-header button')!;
  const dialogEl = () => document.querySelector<HTMLElement>('app-add-person-dialog');
  const nameInput = () => dialogEl()!.querySelector<HTMLInputElement>('input')!;
  const submitButton = () => dialogEl()!.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const fieldError = () => dialogEl()!.querySelector('mat-error')?.textContent?.trim() ?? null;
  const alertText = () => dialogEl()!.querySelector('[role="alert"]')?.textContent?.trim() ?? null;
  const createRequests = () =>
    controller.match((r) => r.method === 'POST' && r.url.endsWith('/Person'));

  async function openDialog() {
    headerButton().click();
    await settle();
    expect(dialogEl()).not.toBeNull();
  }

  async function submitWith(value: string) {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
    submitButton().click();
    await settle();
  }

  const pendingCreate = () =>
    controller.expectOne((r) => r.method === 'POST' && r.url.endsWith('/Person'));

  it('has a persistent Add person button in the page header, also with people listed', async () => {
    await open();
    expect(headerButton().textContent).toContain('Add person');
    expect(headerButton().getAttribute('aria-disabled')).toBeNull();
  });

  describe('without an actor', () => {
    it('blocks the button with a visible hint instead of opening the dialog', async () => {
      await open({ actor: null });
      const button = headerButton();
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      const hint = el.querySelector(`#${button.getAttribute('aria-describedby')}`)!;
      expect(hint.textContent).toContain(TestBed.inject(ActorService).hint);
      button.click();
      await settle();
      expect(dialogEl()).toBeNull();
    });

    it('keeps the empty-state button blocked too', async () => {
      await open({ actor: null, people: [] });
      const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).filter((b) =>
        b.textContent?.includes('Add person'),
      );
      expect(buttons.length).toBe(2);
      for (const button of buttons) {
        expect(button.getAttribute('aria-disabled')).toBe('true');
        button.click();
      }
      await settle();
      expect(dialogEl()).toBeNull();
    });
  });

  it('opens from the empty state when an actor is set', async () => {
    await open({ people: [] });
    el.querySelector<HTMLButtonElement>('.notice button')!.click();
    await settle();
    expect(dialogEl()).not.toBeNull();
  });

  describe('client-side validation (trim, required, at most 200)', () => {
    it.each([
      ['an empty name', '', 'The name is required.'],
      ['a blank name', '   ', 'The name is required.'],
      ['a name over 200 characters', 'x'.repeat(201), 'The name must be at most 200 characters.'],
    ])('rejects %s without sending a request', async (_label, value, message) => {
      await open();
      await openDialog();
      await submitWith(value);
      expect(fieldError()).toBe(message);
      expect(createRequests()).toHaveLength(0);
    });

    it('counts the trimmed length: 200 characters plus spaces is accepted', async () => {
      await open();
      await openDialog();
      await submitWith(`  ${'x'.repeat(200)}  `);
      expect(pendingCreate().request.body).toEqual({ name: 'x'.repeat(200) });
    });
  });

  it('sends the trimmed name with X-Actor, then goes to the new person and says so', async () => {
    await open();
    await openDialog();
    await submitWith('  Ann Lee  ');

    const request = pendingCreate();
    expect(request.request.body).toEqual({ name: 'Ann Lee' });
    expect(request.request.headers.get('X-Actor')).toBe('Ada');
    request.flush({ success: true, message: 'Successful', responseCode: 201, id: 9 });
    await settle();

    await vi.waitFor(() => expect(dialogEl()).toBeNull());
    expect(TestBed.inject(Router).url).toBe('/people/Ann%20Lee');
    controller
      .expectOne((r) => r.method === 'GET' && r.url.includes('/AstronautDuty/Ann%20Lee'))
      .flush({
        success: true,
        message: 'Successful',
        responseCode: 200,
        person: { ...PERSON, name: 'Ann Lee', astronautStatus: 'None' },
        astronautDuties: [],
      });
    await settle();
    expect(document.querySelector('.mat-mdc-snack-bar-container')?.textContent).toContain(
      'Added Ann Lee.',
    );
  });

  it('shows a 409 duplicate as an inline error on the name field and keeps the dialog open', async () => {
    await open();
    await openDialog();
    await submitWith('john doe');
    pendingCreate().flush(
      { success: false, message: 'A person with this name already exists.', responseCode: 409 },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();

    expect(fieldError()).toBe('A person with this name already exists.');
    expect(alertText()).toBeNull();
    expect(nameInput().getAttribute('aria-invalid')).toBe('true');
    expect(TestBed.inject(Router).url).toBe('/people');
    expect(submitButton().getAttribute('aria-disabled')).toBeNull();

    // Editing the name clears the server error, and submitting again sends a new request.
    await submitWith('Johnny Doe');
    expect(pendingCreate().request.body).toEqual({ name: 'Johnny Doe' });
  });

  it('maps a 400 errors[] entry for name onto the field and X-Actor onto a form-level message', async () => {
    await open();
    await openDialog();
    await submitWith('Ann');
    pendingCreate().flush(
      {
        success: false,
        message: 'Validation failed.',
        responseCode: 400,
        errors: [
          { field: 'name', message: 'The name must be at most 200 characters.' },
          { field: 'X-Actor', message: 'The X-Actor header is required.' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();
    expect(fieldError()).toBe('The name must be at most 200 characters.');
    expect(alertText()).toContain('Acting as');
  });

  it('shows any other failure as a dismissible message and allows a retry', async () => {
    await open();
    await openDialog();
    await submitWith('Ann');
    pendingCreate().flush(
      { success: false, message: 'Database is down.', responseCode: 500 },
      { status: 500, statusText: 'Server Error' },
    );
    await settle();
    expect(alertText()).toContain('Database is down.');
    expect(fieldError()).toBeNull();

    dialogEl()!.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    await settle();
    expect(alertText()).toBeNull();
    expect(submitButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('does not double submit: two quick clicks send one request and the button is disabled meanwhile', async () => {
    await open();
    await openDialog();
    nameInput().value = 'Ann Lee';
    nameInput().dispatchEvent(new Event('input'));
    submitButton().click();
    submitButton().click();
    await settle();
    const requests = createRequests();
    expect(requests).toHaveLength(1);
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    submitButton().click();
    await settle();
    expect(createRequests()).toHaveLength(0);
    requests[0].flush({ success: true, message: 'Successful', responseCode: 201, id: 9 });
    await settle();
    controller.match((r) => r.url.includes('/AstronautDuty/'));
  });

  it('cannot be dismissed while the request is in flight', async () => {
    await open();
    await openDialog();
    nameInput().value = 'Ann Lee';
    nameInput().dispatchEvent(new Event('input'));
    submitButton().click();
    await settle();
    const cancel = dialogEl()!.querySelector<HTMLButtonElement>('button[mat-dialog-close]')!;
    expect(cancel.disabled).toBe(true);
    dialogEl()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(dialogEl()).not.toBeNull();
    createRequests()[0].flush({ success: true, message: 'Successful', responseCode: 201, id: 9 });
    await settle();
    await vi.waitFor(() => expect(dialogEl()).toBeNull());
    controller.match((r) => r.url.includes('/AstronautDuty/'));
  });

  it('closes with Cancel without a request', async () => {
    await open();
    await openDialog();
    dialogEl()!.querySelector<HTMLButtonElement>('button[mat-dialog-close]')!.click();
    await vi.waitFor(() => expect(dialogEl()).toBeNull());
    expect(createRequests()).toHaveLength(0);
  });
});
