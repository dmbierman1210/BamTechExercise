import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import type {
  CreatePersonRequest,
  CreatedResponse,
  BaseResponse,
  PersonListResponse,
  PersonResponse,
  RenamePersonRequest,
} from './models';

/** People routes of the contract. Method names are the operation ids. */
@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** GET /Person */
  getPeople(): Observable<PersonListResponse> {
    return this.http.get<PersonListResponse>(`${this.baseUrl}/Person`);
  }

  /** GET /Person/{name} */
  getPersonByName(name: string): Observable<PersonResponse> {
    return this.http.get<PersonResponse>(`${this.baseUrl}/Person/${encodeURIComponent(name)}`);
  }

  /** POST /Person (write: needs X-Actor) */
  createPerson(request: CreatePersonRequest): Observable<CreatedResponse> {
    return this.http.post<CreatedResponse>(`${this.baseUrl}/Person`, request);
  }

  /** PUT /Person/{name} (write: needs X-Actor) */
  renamePerson(name: string, request: RenamePersonRequest): Observable<BaseResponse> {
    return this.http.put<BaseResponse>(
      `${this.baseUrl}/Person/${encodeURIComponent(name)}`,
      request,
    );
  }
}
