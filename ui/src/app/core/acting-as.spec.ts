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
});
