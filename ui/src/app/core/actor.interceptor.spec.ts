import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { actorInterceptor } from './actor.interceptor';
import { ActorService } from './actor.service';

describe('actorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let actors: ActorService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([actorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    actors = TestBed.inject(ActorService);
  });

  afterEach(() => controller.verify());

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('adds X-Actor to %s', (method) => {
    actors.setActor('  Ada  ');
    http.request(method, '/x', { body: {} }).subscribe();
    const req = controller.expectOne('/x');
    expect(req.request.headers.get('X-Actor')).toBe('Ada');
    req.flush({});
  });

  it('does not add X-Actor to GET', () => {
    actors.setActor('Ada');
    http.get('/x').subscribe();
    const req = controller.expectOne('/x');
    expect(req.request.headers.has('X-Actor')).toBe(false);
    req.flush({});
  });

  it('sends no header while no name is set', () => {
    http.post('/x', {}).subscribe();
    const req = controller.expectOne('/x');
    expect(req.request.headers.has('X-Actor')).toBe(false);
    req.flush({});
  });

  it('picks up a name changed after the first request', () => {
    actors.setActor('Ada');
    http.post('/x', {}).subscribe();
    expect(controller.expectOne('/x').request.headers.get('X-Actor')).toBe('Ada');
    actors.setActor('Grace');
    http.post('/y', {}).subscribe();
    expect(controller.expectOne('/y').request.headers.get('X-Actor')).toBe('Grace');
  });
});
