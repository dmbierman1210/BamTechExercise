import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavContent, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ActingAs } from './core/acting-as';
import { ConnectionBanner } from './core/connection-banner';
import { scrollBehavior } from './core/motion';
import { StatusAnnouncer } from './core/status-announcer';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

/** The URL without query string and fragment: list filters change the query, not the page. */
const pathOf = (url: string): string => url.split(/[?#]/, 1)[0];

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    ActingAs,
    ConnectionBanner,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly sidenav = viewChild(MatSidenav);
  private readonly content = viewChild(MatSidenavContent);
  private readonly main = viewChild<ElementRef<HTMLElement>>('mainContent');
  private readonly injector = inject(Injector);

  protected readonly announcer = inject(StatusAnnouncer);
  protected readonly appName = 'Stargate ACTS';
  protected readonly navItems: NavItem[] = [{ label: 'People', path: '/people', icon: 'groups' }];

  /** On phone widths the nav links move from the toolbar into a slide-over sidenav. */
  protected readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  constructor() {
    let currentPath: string | null = null;
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        void this.sidenav()?.close();
        const path = pathOf(event.urlAfterRedirects);
        const firstLoad = currentPath === null;
        const changed = path !== currentPath;
        currentPath = path;
        // Not on the first load (the skip link must stay the first tab stop) and not for filter changes.
        if (!firstLoad && changed) {
          const scroller = this.content()?.getElementRef().nativeElement;
          if (typeof scroller?.scrollTo === 'function') {
            scroller.scrollTo({ top: 0, behavior: scrollBehavior() });
          }
          afterNextRender(() => this.focusPage(), { injector: this.injector });
        }
      });
  }

  protected toggleNav(): void {
    void this.sidenav()?.toggle();
  }

  /** After a page change, keyboard and screen reader users start at the new page's heading. */
  private focusPage(): void {
    const main = this.main()?.nativeElement;
    const heading = main?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    } else {
      main?.focus();
    }
  }
}
