import { HttpErrorResponse } from '@angular/common/http';
import { API_UNREACHABLE_MESSAGE, ApiError } from './api-error';

const httpError = (status: number, body: unknown) =>
  new HttpErrorResponse({ status, error: body, url: 'http://api/x' });

describe('ApiError.fromHttpError', () => {
  it('maps a validation envelope with field errors', () => {
    const error = ApiError.fromHttpError(
      httpError(400, {
        success: false,
        message: 'Validation failed.',
        responseCode: 400,
        errors: [
          { field: 'X-Actor', message: 'The X-Actor header is required.' },
          { field: 'reason', message: 'A reason is required when the duty starts in the future.' },
        ],
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation failed.');
    expect(error.errors).toHaveLength(2);
    expect(error.fieldMessage('x-actor')).toBe('The X-Actor header is required.');
    expect(error.fieldMessage('reason')).toContain('future');
    expect(error.fieldMessage('name')).toBeUndefined();
    expect(error.isNetworkError).toBe(false);
  });

  it.each([
    [404, 'Person not found.'],
    [409, 'A person with this name already exists.'],
    [500, 'An unexpected error occurred.'],
  ])('maps a %i envelope without field errors', (status, message) => {
    const error = ApiError.fromHttpError(
      httpError(status, { success: false, message, responseCode: status }),
    );
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error.errors).toEqual([]);
  });

  it('maps a network failure (status 0) to "API unreachable"', () => {
    const error = ApiError.fromHttpError(httpError(0, new ProgressEvent('error')));
    expect(error.status).toBe(0);
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toBe(API_UNREACHABLE_MESSAGE);
    expect(error.message).toMatch(/API unreachable/);
  });

  it('falls back to a generic message when the body is not an envelope', () => {
    const error = ApiError.fromHttpError(httpError(502, '<html>Bad gateway</html>'));
    expect(error.status).toBe(502);
    expect(error.message).toContain('502');
    expect(error.errors).toEqual([]);
  });

  it('drops malformed entries in errors', () => {
    const error = ApiError.fromHttpError(
      httpError(400, {
        success: false,
        message: 'Validation failed.',
        responseCode: 400,
        errors: [{ field: 'name', message: 'The name is required.' }, { nope: true }, 'x'],
      }),
    );
    expect(error.errors).toEqual([{ field: 'name', message: 'The name is required.' }]);
  });
});
