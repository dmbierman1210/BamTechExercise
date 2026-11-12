import { TestBed } from '@angular/core/testing';
import { ApiError } from '../api/api-error';
import { ConnectionBanner } from './connection-banner';
import { ConnectionStatus } from './connection-status';

describe('ConnectionBanner (offline / API-down message)', () => {
  function render() {
    const fixture = TestBed.createComponent(ConnectionBanner);
    const status = TestBed.inject(ConnectionStatus);
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, status, el };
  }

  it('keeps an empty alert region in the page while there is no problem', async () => {
    const { fixture, el } = render();
    await fixture.whenStable();
    const region = el.querySelector('[role="alert"]')!;
    expect(region).not.toBeNull();
    expect(region.textContent?.trim()).toBe('');
  });

  it('shows the offline message with Retry, inside the same region', async () => {
    const { fixture, status, el } = render();
    window.dispatchEvent(new Event('offline'));
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"] .banner-offline')?.textContent).toContain(
      'You are offline',
    );
    const retry = el.querySelector<HTMLButtonElement>('button.retry')!;
    window.dispatchEvent(new Event('online'));
    expect(status.problem()).toBeNull();
    expect(retry).not.toBeNull();
  });

  it('shows "cannot reach the API" with a Retry that asks the pages to reload', async () => {
    const { fixture, status, el } = render();
    status.reportFailure(new ApiError(0, 'x'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Cannot reach the API');
    const ticks = status.retryTick();
    el.querySelector<HTMLButtonElement>('button.retry')!.click();
    await fixture.whenStable();
    expect(status.retryTick()).toBe(ticks + 1);
    expect(el.querySelector('.banner')).toBeNull();
  });

  it('shows a dismissible banner for a server error, without Retry', async () => {
    const { fixture, status, el } = render();
    status.reportFailure(new ApiError(503, 'x'));
    await fixture.whenStable();
    expect(el.textContent).toContain('HTTP 503');
    expect(el.querySelector('button.retry')).toBeNull();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Dismiss'))!
      .click();
    await fixture.whenStable();
    expect(el.querySelector('.banner')).toBeNull();
  });
});
