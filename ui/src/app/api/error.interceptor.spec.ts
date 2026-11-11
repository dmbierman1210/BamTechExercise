import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConnectionStatus } from '../core/connection-status';
import { ApiError } from './api-error';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  function failureOf(request: () => ReturnType<HttpClient['get']>): { error?: unknown } {
    const result: { error?: unknown } = {};
    request().subscribe({ error: (e: unknown) => (result.error = e) });
    return result;
  }

  it('turns an error envelope into an ApiError', () => {
    const result = failureOf(() => http.get('/Person/x'));
    controller
      .expectOne('/Person/x')
      .flush(
        { success: false, message: 'Person not found.', responseCode: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    expect(result.error).toBeInstanceOf(ApiError);
    expect((result.error as ApiError).status).toBe(404);
    expect((result.error as ApiError).message).toBe('Person not found.');
  });

  it('turns a network error into an "API unreachable" ApiError with status 0', () => {
    const result = failureOf(() => http.get('/Person'));
    controller.expectOne('/Person').error(new ProgressEvent('error'));
    expect(result.error).toBeInstanceOf(ApiError);
    expect((result.error as ApiError).status).toBe(0);
    expect((result.error as ApiError).message).toMatch(/API unreachable/);
  });

  it('passes successful responses through untouched', () => {
    let body: unknown;
    http.get('/Person').subscribe((b) => (body = b));
    controller.expectOne('/Person').flush({ success: true });
    expect(body).toEqual({ success: true });
  });

  describe('connection status', () => {
    let status: ConnectionStatus;
    beforeEach(() => (status = TestBed.inject(ConnectionStatus)));

    it('reports an unreachable API on a network error and clears it on the next response', () => {
      failureOf(() => http.get('/Person'));
      controller.expectOne('/Person').error(new ProgressEvent('error'));
      expect(status.problem()?.kind).toBe('unreachable');

      http.get('/Person').subscribe();
      controller.expectOne('/Person').flush({ success: true });
      expect(status.problem()).toBeNull();
    });

    it('reports a server error for 5xx, but not for 4xx (those belong to the page)', () => {
      failureOf(() => http.get('/Person'));
      controller
        .expectOne('/Person')
        .flush(
          { success: false, message: 'Boom', responseCode: 503 },
          { status: 503, statusText: 'x' },
        );
      expect(status.problem()).toEqual({
        kind: 'server-error',
        message: 'The API reported a problem (HTTP 503). Some data may be out of date.',
      });

      failureOf(() => http.get('/Person/x'));
      controller
        .expectOne('/Person/x')
        .flush(
          { success: false, message: 'Nope', responseCode: 404 },
          { status: 404, statusText: 'x' },
        );
      expect(status.problem()).toBeNull();
    });
  });
});
