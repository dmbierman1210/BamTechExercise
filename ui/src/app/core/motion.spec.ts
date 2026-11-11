import { prefersReducedMotion, REDUCED_MOTION_QUERY, scrollBehavior } from './motion';

describe('motion preference helper', () => {
  const host = (matches: boolean) => ({
    matchMedia: vi.fn().mockReturnValue({ matches }),
  });

  it('is true when the user prefers reduced motion, and asks the right media query', () => {
    const win = host(true);
    expect(prefersReducedMotion(win)).toBe(true);
    expect(win.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });

  it('is false when motion is welcome, or when matchMedia is missing', () => {
    expect(prefersReducedMotion(host(false))).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
    expect(prefersReducedMotion(null)).toBe(false);
  });

  it('scrolls smoothly only when motion is welcome', () => {
    expect(scrollBehavior(host(false))).toBe('smooth');
    expect(scrollBehavior(host(true))).toBe('auto');
  });
});
