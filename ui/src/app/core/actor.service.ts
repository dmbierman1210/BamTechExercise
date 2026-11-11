import { Injectable, computed, signal } from '@angular/core';

export const ACTOR_STORAGE_KEY = 'acts.actor';
export const ACTOR_MAX_LENGTH = 100;
export const ACTOR_REQUIRED_HINT = 'Set your name under "Acting as" to make changes.';

/** Returns an error message, or null when the (trimmed) name is acceptable. */
export function validateActorName(value: string | null | undefined): string | null {
  const name = (value ?? '').trim();
  if (name.length === 0) {
    return 'A name is required.';
  }
  if (name.length > ACTOR_MAX_LENGTH) {
    return `The name must be at most ${ACTOR_MAX_LENGTH} characters.`;
  }
  // The name travels in an HTTP header: keep it to printable ASCII so every server decodes it the same way.
  if (!/^[\x20-\x7E]+$/.test(name)) {
    return 'Use plain letters, digits and punctuation only (no accents, emoji or non-Latin characters).';
  }
  return null;
}

/**
 * Who is making changes. Self-declared and unverified: it is sent as the X-Actor header on every write
 * request and kept in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ActorService {
  private readonly name = signal<string | null>(readStoredActor());

  /** The current actor name, or null when none has been set. */
  readonly actor = this.name.asReadonly();
  /** True once a valid name is set; write actions are disabled while this is false. */
  readonly hasActor = computed(() => this.name() !== null);
  readonly hint = ACTOR_REQUIRED_HINT;

  /** Stores the trimmed name. Returns the validation error, or null on success. */
  setActor(value: string): string | null {
    const error = validateActorName(value);
    if (error) {
      return error;
    }
    const name = value.trim();
    this.name.set(name);
    try {
      localStorage.setItem(ACTOR_STORAGE_KEY, name);
    } catch {
      // Storage can be unavailable (private mode); the name then lasts for this session only.
    }
    return null;
  }

  clearActor(): void {
    this.name.set(null);
    try {
      localStorage.removeItem(ACTOR_STORAGE_KEY);
    } catch {
      // see setActor
    }
  }
}

function readStoredActor(): string | null {
  try {
    const stored = localStorage.getItem(ACTOR_STORAGE_KEY);
    return stored !== null && validateActorName(stored) === null ? stored.trim() : null;
  } catch {
    return null;
  }
}
