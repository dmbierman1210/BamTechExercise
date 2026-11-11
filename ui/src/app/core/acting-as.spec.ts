import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { ActingAs } from './acting-as';
import { ACTOR_STORAGE_KEY, ActorService } from './actor.service';

describe('ActingAs control', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ActingAs] }).compileComponents();
  });

  afterEach(() => TestBed.inject(OverlayContainer).ngOnDestroy());

  async function openDialog() {
    const fixture = TestBed.createComponent(ActingAs);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    return { fixture, overlay };
  }

  it('opens a dialog that labels the name as self-declared, not verified', async () => {
    const { overlay } = await openDialog();
    expect(overlay.textContent).toContain('self-declared, not verified');
    expect(overlay.querySelector('input')).toBeTruthy();
  });

  it('saves a trimmed name and shows it on the button', async () => {
    const { fixture, overlay } = await openDialog();
    const input = overlay.querySelector('input') as HTMLInputElement;
    input.value = '  Ada Lovelace ';
    input.dispatchEvent(new Event('input'));
    overlay.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(TestBed.inject(ActorService).actor()).toBe('Ada Lovelace');
    expect(localStorage.getItem(ACTOR_STORAGE_KEY)).toBe('Ada Lovelace');
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('does not save a blank name and shows an error', async () => {
    const { fixture, overlay } = await openDialog();
    const input = overlay.querySelector('input') as HTMLInputElement;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    overlay.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(TestBed.inject(ActorService).hasActor()).toBe(false);
    expect(overlay.textContent).toContain('A name is required.');
  });

  it('puts focus in the name field and returns it to the toolbar button when the dialog closes', async () => {
    const fixture = TestBed.createComponent(ActingAs);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    button.focus();
    button.click();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    await vi.waitFor(() => expect(document.activeElement).toBe(overlay.querySelector('input')));
    expect(overlay.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBeTruthy();

    overlay.querySelector<HTMLButtonElement>('button[mat-dialog-close]')!.click();
    await vi.waitFor(() => expect(overlay.querySelector('input')).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('labels the button for screen readers with the name and "self-declared, not verified"', async () => {
    localStorage.setItem(ACTOR_STORAGE_KEY, 'Ada Lovelace');
    const fixture = TestBed.createComponent(ActingAs);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    const label = button.getAttribute('aria-label')!;
    expect(label).toContain('Ada Lovelace');
    expect(label).toContain('self-declared, not verified');
    // WCAG 2.5.3 (label in name): the visible text, with its space, starts the accessible name.
    const visible = button
      .querySelector('.acting-as-text')!
      .textContent!.replace(/\s+/g, ' ')
      .trim();
    expect(visible).toBe('Acting as Ada Lovelace');
    expect(label.startsWith(visible)).toBe(true);
  });

  it('clears the name from the dialog', async () => {
    localStorage.setItem(ACTOR_STORAGE_KEY, 'Ada Lovelace');
    const { fixture, overlay } = await openDialog();
    const clear = Array.from(overlay.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear name'),
    )!;
    clear.click();
    await fixture.whenStable();
    expect(TestBed.inject(ActorService).hasActor()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Set your name');
  });
});
