import { type ResolveFn, Routes } from '@angular/router';

/** The decoded name from the URL; the page replaces it with the canonical name once it has loaded. */
const personTitle: ResolveFn<string> = (route) => route.paramMap.get('name') ?? 'Person';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'people' },
  {
    path: 'people',
    title: 'People',
    loadComponent: () => import('./pages/people-page').then((m) => m.PeoplePage),
  },
  {
    path: 'people/:name',
    title: personTitle,
    loadComponent: () => import('./pages/person-page').then((m) => m.PersonPage),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
  },
];
