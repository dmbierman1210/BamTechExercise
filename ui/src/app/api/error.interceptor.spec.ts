import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
});
