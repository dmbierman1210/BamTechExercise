import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'people' },
  {
    path: 'people',
    title: 'People | Stargate ACTS',
    loadComponent: () => import('./pages/people-page').then((m) => m.PeoplePage),
  },
  {
    path: '**',
    title: 'Not found | Stargate ACTS',
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
  },
];
