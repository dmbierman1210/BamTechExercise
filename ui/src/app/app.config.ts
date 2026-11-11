import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { errorInterceptor } from './api/error.interceptor';
import { actorInterceptor } from './core/actor.interceptor';
import { AppTitleStrategy } from './core/page-title';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    provideHttpClient(withInterceptors([actorInterceptor, errorInterceptor])),
  ],
};
