import { TestBed } from '@angular/core/testing';
import { ACTOR_STORAGE_KEY, ActorService, validateActorName } from './actor.service';

describe('validateActorName', () => {
  it('accepts 1 to 100 characters after trimming', () => {
    expect(validateActorName('a')).toBeNull();
    expect(validateActorName('  Flight Director  ')).toBeNull();
    expect(validateActorName('x'.repeat(100))).toBeNull();
  });

  it('rejects blank and over-long names', () => {
    expect(validateActorName('')).not.toBeNull();
    expect(validateActorName('    ')).not.toBeNull();
    expect(validateActorName(null)).not.toBeNull();
    expect(validateActorName('x'.repeat(101))).not.toBeNull();
  });
});

describe('ActorService', () => {
  beforeEach(() => localStorage.clear());

  it('has no actor until a name is set', () => {
    const service = TestBed.inject(ActorService);
    expect(service.hasActor()).toBe(false);
    expect(service.actor()).toBeNull();
  });

  it('stores the trimmed name and persists it in localStorage', () => {
    const service = TestBed.inject(ActorService);
    expect(service.setActor('  Ada Lovelace ')).toBeNull();
    expect(service.actor()).toBe('Ada Lovelace');
    expect(service.hasActor()).toBe(true);
    expect(localStorage.getItem(ACTOR_STORAGE_KEY)).toBe('Ada Lovelace');
  });

  it('keeps the previous name when the new one is invalid', () => {
    const service = TestBed.inject(ActorService);
    service.setActor('Ada');
    expect(service.setActor('   ')).toBeTruthy();
    expect(service.actor()).toBe('Ada');
  });

  it('reads the stored name when created, and clears it', () => {
    localStorage.setItem(ACTOR_STORAGE_KEY, 'Grace Hopper');
    const service = TestBed.inject(ActorService);
    expect(service.actor()).toBe('Grace Hopper');
    service.clearActor();
    expect(service.hasActor()).toBe(false);
    expect(localStorage.getItem(ACTOR_STORAGE_KEY)).toBeNull();
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(ACTOR_STORAGE_KEY, 'x'.repeat(150));
    expect(TestBed.inject(ActorService).hasActor()).toBe(false);
  });
});
