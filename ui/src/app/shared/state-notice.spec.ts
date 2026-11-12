import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StateNotice } from './state-notice';

@Component({
  imports: [StateNotice],
  template: `
    <app-state-notice illustration="error" heading="Could not load" [alert]="alert">
      <p>Try again.</p>
    </app-state-notice>
    <app-state-notice illustration="people" heading="Top" [headingLevel]="1" />
  `,
})
class Host {
  alert = true;
}

describe('StateNotice', () => {
  it('renders an illustration (hidden from assistive tech), the heading level and the projected content', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const [first, second] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-state-notice'),
    );
    expect(first.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(first.querySelector('h2')?.textContent).toBe('Could not load');
    expect(first.querySelector('p')?.textContent).toBe('Try again.');
    expect(first.getAttribute('role')).toBe('alert');
    expect(second.querySelector('h1')?.textContent).toBe('Top');
    expect(second.getAttribute('role')).toBeNull();
  });
});
