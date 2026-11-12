import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-config';
import { DutyService } from './duty.service';
import { PersonService } from './person.service';

const BASE = 'http://api.test';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('PersonService', () => {
  it('getPeople: GET /Person', () => {
    const controller = setup();
    let count = -1;
    TestBed.inject(PersonService)
      .getPeople()
      .subscribe((r) => (count = r.people.length));
    const req = controller.expectOne(`${BASE}/Person`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'Successful', responseCode: 200, people: [] });
    expect(count).toBe(0);
    controller.verify();
  });

  it('getPersonByName: encodes the name in the path', () => {
    const controller = setup();
    TestBed.inject(PersonService).getPersonByName('John / Doe?').subscribe();
    const req = controller.expectOne(`${BASE}/Person/John%20%2F%20Doe%3F`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('createPerson: POST /Person with the body', () => {
    const controller = setup();
    TestBed.inject(PersonService).createPerson({ name: 'Ann' }).subscribe();
    const req = controller.expectOne(`${BASE}/Person`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Ann' });
    req.flush({});
  });

  it('renamePerson: PUT /Person/{name} with newName', () => {
    const controller = setup();
    TestBed.inject(PersonService).renamePerson('Ann Lee', { newName: 'Anne Lee' }).subscribe();
    const req = controller.expectOne(`${BASE}/Person/Ann%20Lee`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newName: 'Anne Lee' });
    req.flush({});
  });
});

describe('DutyService', () => {
  it('getAstronautDutiesByName: GET /AstronautDuty/{name}', () => {
    const controller = setup();
    TestBed.inject(DutyService).getAstronautDutiesByName('John Doe').subscribe();
    const req = controller.expectOne(`${BASE}/AstronautDuty/John%20Doe`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('createAstronautDuty: POST /AstronautDuty with the body', () => {
    const controller = setup();
    const body = {
      name: 'John Doe',
      rank: '1LT',
      dutyTitle: 'Commander',
      dutyStartDate: '2020-01-15',
    };
    TestBed.inject(DutyService).createAstronautDuty(body).subscribe();
    const req = controller.expectOne(`${BASE}/AstronautDuty`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});

describe('API_BASE_URL default', () => {
  it('comes from the environment config without a trailing slash', () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(API_BASE_URL)).toMatch(/^http:\/\/localhost:\d+$/);
  });
});
