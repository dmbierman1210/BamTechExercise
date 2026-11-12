import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'people' },
  {
    path: 'people',
    title: 'People | Stargate ACTS',
    loadComponent: () => import('./pages/people-page').then((m) => m.PeoplePage),
  },
  {
    // Placeholder until STAR-12 builds the person page.
    path: 'people/:name',
    title: 'Person | Stargate ACTS',
    loadComponent: () =>
      import('./pages/person-placeholder-page').then((m) => m.PersonPlaceholderPage),
  },
  {
    path: '**',
    title: 'Not found | Stargate ACTS',
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
  },
];
