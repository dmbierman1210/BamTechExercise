import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonService } from '../api/person.service';
import { errorInterceptor } from '../api/error.interceptor';
import { ActorRequiredDirective } from './actor-required.directive';
import { actorInterceptor } from './actor.interceptor';
import { ActorService } from './actor.service';

@Component({
  selector: 'app-test-host',
  imports: [ActorRequiredDirective],
  template: `<button type="button" appActorRequired (click)="add()">Add person</button>`,
})
class TestHost {
  private readonly people = inject(PersonService);
  add(): void {
    this.people.createPerson({ name: 'Ann Lee' }).subscribe();
  }
}

describe('ActorRequiredDirective (writes are blocked until a name is set)', () => {
  let fixture: ComponentFixture<TestHost>;
  let controller: HttpTestingController;
  let actors: ActorService;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        provideHttpClient(withInterceptors([actorInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    controller = TestBed.inject(HttpTestingController);
    actors = TestBed.inject(ActorService);
    button = fixture.nativeElement.querySelector('button');
    await fixture.whenStable();
  });

  afterEach(() => controller.verify());

  it('disables the control and shows the hint while no name is set', () => {
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.title).toBe(actors.hint);
    button.click();
    controller.expectNone((request) => request.method === 'POST');
  });

  it('enables the control once a name is set and the write carries X-Actor', async () => {
    actors.setActor('Ada Lovelace');
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute('title')).toBe(false);

    button.click();
    const req = controller.expectOne((r) => r.method === 'POST' && r.url.endsWith('/Person'));
    expect(req.request.headers.get('X-Actor')).toBe('Ada Lovelace');
    expect(req.request.body).toEqual({ name: 'Ann Lee' });
    req.flush({ success: true, message: 'Successful', responseCode: 201, id: 4 });
  });

  it('blocks the control again when the name is cleared', async () => {
    actors.setActor('Ada');
    await fixture.whenStable();
    actors.clearActor();
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
  });
});
