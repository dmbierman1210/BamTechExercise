import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import axe from 'axe-core';
import { App } from './app';
import { routes } from './app.routes';
import { ApiError } from './api/api-error';
import { errorInterceptor } from './api/error.interceptor';
import type { AstronautDuty, PersonAstronaut } from './api/models';
import { actorInterceptor } from './core/actor.interceptor';
import { ActorService } from './core/actor.service';
import { ConnectionStatus } from './core/connection-status';
import { AppTitleStrategy } from './core/page-title';

/**
 * Automated accessibility scan (axe-core) of the rendered app: people list, person detail, the forms and the
 * dialogs. jsdom has no layout, so the color-contrast rule is switched off here and checked in a real browser
 * instead (`npm run a11y:browser`). Fails on serious or critical violations.
 */
const PEOPLE: PersonAstronaut[] = [
  {
    personId: 1,
    name: 'John Doe',
    currentRank: 'CPT',
    currentDutyTitle: 'Commander',
    careerStartDate: '2020-01-15',
    careerEndDate: null,
    astronautStatus: 'Active',
  },
  {
    personId: 2,
    name: 'Jane Roe',
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
const duty = (id: number, over: Partial<AstronautDuty>): AstronautDuty => ({
  id,
  personId: 2,
  rank: 'COL',
  dutyTitle: 'Commander',
  dutyStartDate: '2010-01-01',
  dutyEndDate: null,
  reason: null,
  ...over,
});
const DUTIES = [
  duty(3, { dutyTitle: 'RETIRED', dutyStartDate: '2020-01-02', reason: 'Retired after 10 years' }),
  duty(2, { dutyStartDate: '2015-06-01', dutyEndDate: '2020-01-01' }),
  duty(1, { rank: 'MAJ', dutyTitle: 'Pilot', dutyEndDate: '2015-05-31' }),
];
const envelope = (extra: object) => ({
  success: true,
  message: 'Successful',
  responseCode: 200,
  ...extra,
});

async function seriousViolations(root: Element): Promise<string[]> {
  const results = await axe.run(root as HTMLElement, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    );
}

describe('Accessibility scan (axe-core, serious and critical)', () => {
  let controller: HttpTestingController;
  let fixture: ComponentFixture<App>;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideHttpClient(withInterceptors([actorInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    TestBed.inject(ActorService).setActor('Ada');
    fixture = TestBed.createComponent(App);
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    controller.match(() => true);
  });

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function go(url: string) {
    await TestBed.inject(Router).navigateByUrl(url);
    await settle();
  }

  async function showPeople(people: PersonAstronaut[] = PEOPLE) {
    await go('/people');
    controller.expectOne((r) => r.url.endsWith('/Person')).flush(envelope({ people }));
    await settle();
  }

  async function showPerson(person = PEOPLE[1], duties = DUTIES) {
    await go(`/people/${encodeURIComponent(person.name)}`);
    controller
      .expectOne((r) => r.url.includes('/AstronautDuty/'))
      .flush(envelope({ person, astronautDuties: duties }));
    await settle();
  }

  const click = async (label: string) => {
    Array.from(el.querySelectorAll<HTMLButtonElement>('main button'))
      .find((b) => b.textContent?.includes(label))!
      .click();
    await settle();
  };

  it('people list', async () => {
    await showPeople();
    expect(el.querySelectorAll('.card')).toHaveLength(3);
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('people list: empty, filtered-to-nothing and loading skeleton', async () => {
    await go('/people');
    expect(el.querySelector('.skeleton')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
    controller.expectOne((r) => r.url.endsWith('/Person')).flush(envelope({ people: [] }));
    await settle();
    expect(el.querySelector('app-state-notice svg')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('people list: error state with the global banner', async () => {
    await go('/people');
    controller.expectOne((r) => r.url.endsWith('/Person')).error(new ProgressEvent('error'));
    await settle();
    expect(el.querySelector('app-state-notice[role="alert"]')).not.toBeNull();
    expect(el.querySelector('app-connection-banner .banner')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('person detail with the timeline', async () => {
    await showPerson();
    expect(el.querySelectorAll('ol.timeline > li')).toHaveLength(3);
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('person detail: not found', async () => {
    await go('/people/Nobody');
    controller
      .expectOne((r) => r.url.includes('/AstronautDuty/'))
      .flush(
        { success: false, message: 'Person not found.', responseCode: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('rename form, also with an error showing', async () => {
    await showPerson();
    await click('Rename');
    expect(el.querySelector('form[aria-label="Rename person"]')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);

    const input = el.querySelector<HTMLInputElement>('form input')!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    await settle();
    expect(el.querySelector('mat-error')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('add duty form, also with the reason banner and errors showing', async () => {
    await showPerson();
    await click('Add duty');
    expect(el.querySelector('form[aria-label="Add duty"]')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);

    const date = el.querySelector<HTMLInputElement>('input[type="date"]')!;
    date.value = '2018-01-01';
    date.dispatchEvent(new Event('input'));
    el.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    await settle();
    expect(el.querySelector('.banner')).not.toBeNull();
    expect(el.querySelector('mat-error')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('add person dialog (with the page behind it) and the Acting as dialog', async () => {
    await showPeople();
    await click('Add person');
    expect(document.querySelector('app-add-person-dialog')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
    TestBed.inject(MatDialog).closeAll();
    await settle();

    el.querySelector<HTMLButtonElement>('app-acting-as button')!.click();
    await settle();
    expect(document.querySelector('app-actor-dialog')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('404 page and the blocked write controls without an actor name', async () => {
    await go('/nowhere');
    expect(await seriousViolations(document.body)).toEqual([]);

    TestBed.inject(ActorService).clearActor();
    await showPerson();
    expect(el.querySelector('[aria-disabled="true"]')).not.toBeNull();
    expect(await seriousViolations(document.body)).toEqual([]);
  });

  it('the scan itself works: it reports an image without alternative text', async () => {
    const bad = document.createElement('div');
    bad.innerHTML = '<img src="x.png"><button></button>';
    document.body.appendChild(bad);
    const found = await seriousViolations(bad);
    bad.remove();
    expect(found.join('\n')).toContain('image-alt');
    expect(found.join('\n')).toContain('button-name');
  });

  it('the global banner for an unreachable API', async () => {
    await showPeople();
    TestBed.inject(ConnectionStatus).reportFailure(new ApiError(0, 'down'));
    await settle();
    expect(await seriousViolations(document.body)).toEqual([]);
  });
});
