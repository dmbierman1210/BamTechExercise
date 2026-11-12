import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import type {
  AstronautDutiesResponse,
  CreateAstronautDutyRequest,
  CreatedResponse,
} from './models';

/** Duty routes of the contract. Method names are the operation ids. */
@Injectable({ providedIn: 'root' })
export class DutyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** GET /AstronautDuty/{name}: the person and their duties, newest first */
  getAstronautDutiesByName(name: string): Observable<AstronautDutiesResponse> {
    return this.http.get<AstronautDutiesResponse>(
      `${this.baseUrl}/AstronautDuty/${encodeURIComponent(name)}`,
    );
  }

  /** POST /AstronautDuty (write: needs X-Actor) */
  createAstronautDuty(request: CreateAstronautDutyRequest): Observable<CreatedResponse> {
    return this.http.post<CreatedResponse>(`${this.baseUrl}/AstronautDuty`, request);
  }
}
