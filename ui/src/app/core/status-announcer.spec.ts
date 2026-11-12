import { TestBed } from '@angular/core/testing';
import { StatusAnnouncer } from './status-announcer';

describe('StatusAnnouncer', () => {
  it('holds the latest message for the live region', () => {
    const announcer = TestBed.inject(StatusAnnouncer);
    expect(announcer.message()).toBe('');
    announcer.announce('Loading people…');
    expect(announcer.message()).toBe('Loading people…');
    announcer.announce('Showing 3 of 3 people.');
    expect(announcer.message()).toBe('Showing 3 of 3 people.');
    announcer.clear();
    expect(announcer.message()).toBe('');
  });

  it('makes a repeated message a real change so it is announced again', () => {
    const announcer = TestBed.inject(StatusAnnouncer);
    announcer.announce('Saved.');
    const first = announcer.message();
    announcer.announce('Saved.');
    const second = announcer.message();
    announcer.announce('Saved.');
    expect(second).not.toBe(first);
    expect(second.trim()).toBe('Saved.');
    expect(announcer.message()).toBe(first);
  });
});
