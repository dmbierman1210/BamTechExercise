import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** Base URL of the ACTS API (no trailing slash). Defaults to the value of the active environment file. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl.replace(/\/+$/, ''),
});
