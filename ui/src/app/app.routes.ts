import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'people' },
  {
    path: 'people',
    title: 'People | Stargate ACTS',
    loadComponent: () => import('./pages/people-page').then((m) => m.PeoplePage),
  },
  {
    path: 'people/:name',
    title: 'Person | Stargate ACTS',
    loadComponent: () => import('./pages/person-page').then((m) => m.PersonPage),
  },
  {
    path: '**',
    title: 'Not found | Stargate ACTS',
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
  },
];
