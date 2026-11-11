import { TestBed } from '@angular/core/testing';
import { ApiError } from '../api/api-error';
import { ConnectionStatus, OFFLINE_MESSAGE, UNREACHABLE_MESSAGE } from './connection-status';

describe('ConnectionStatus', () => {
  let status: ConnectionStatus;

  beforeEach(() => {
    status = TestBed.inject(ConnectionStatus);
  });

  it('has no problem while the browser is online and the API answers', () => {
    expect(status.problem()).toBeNull();
  });

  it('shows "offline" when the browser goes offline, and retries by itself when it is back', () => {
    const ticks = status.retryTick();
    window.dispatchEvent(new Event('offline'));
    expect(status.problem()).toEqual({ kind: 'offline', message: OFFLINE_MESSAGE });

    window.dispatchEvent(new Event('online'));
    expect(status.problem()).toBeNull();
    expect(status.retryTick()).toBe(ticks + 1);
  });

  it('prefers "offline" over an API failure', () => {
    status.reportFailure(new ApiError(0, 'x'));
    expect(status.problem()?.kind).toBe('unreachable');
    expect(status.problem()?.message).toBe(UNREACHABLE_MESSAGE);
    window.dispatchEvent(new Event('offline'));
    expect(status.problem()?.kind).toBe('offline');
    window.dispatchEvent(new Event('online'));
  });

  it('maps statuses: 0 unreachable, 5xx server error, anything else is not a connection problem', () => {
    status.reportFailure(new ApiError(502, 'x'));
    expect(status.problem()?.kind).toBe('server-error');
    status.reportFailure(new ApiError(409, 'x'));
    expect(status.problem()).toBeNull();
    status.reportFailure(new ApiError(0, 'x'));
    status.reportSuccess();
    expect(status.problem()).toBeNull();
  });

  it('retry clears the message and asks pages to reload; dismiss only clears', () => {
    status.reportFailure(new ApiError(0, 'x'));
    const ticks = status.retryTick();
    status.retry();
    expect(status.problem()).toBeNull();
    expect(status.retryTick()).toBe(ticks + 1);

    status.reportFailure(new ApiError(500, 'x'));
    status.dismiss();
    expect(status.problem()).toBeNull();
    expect(status.retryTick()).toBe(ticks + 1);
  });
});
