export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface MediaHost {
  matchMedia?: (query: string) => { matches: boolean };
}

/** True when the user asked the OS or browser for less motion. False where matchMedia does not exist. */
export function prefersReducedMotion(
  host: MediaHost | null = typeof window === 'undefined' ? null : window,
): boolean {
  return host?.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

/** Scroll behavior that respects the preference: smooth only when motion is welcome. */
export function scrollBehavior(host?: MediaHost | null): ScrollBehavior {
  return prefersReducedMotion(host) ? 'auto' : 'smooth';
}
