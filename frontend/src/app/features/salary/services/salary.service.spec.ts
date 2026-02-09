import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SalaryService } from './salary.service';
import { environment } from '../../../environments/environment';

describe('SalaryService', () => {
  let service: SalaryService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalaryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMine calls GET /salary/me', () => {
    service.getMine().subscribe();
    const req = httpMock.expectOne(`${base}/salary/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('upsert calls PUT /salary/me with body', () => {
    const dto = { grossAmount: 5000, netAmount: 3500 };
    service.upsert(dto as any).subscribe();
    const req = httpMock.expectOne(`${base}/salary/me`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('getMyYearly calls GET /salary/me/yearly/:year', () => {
    service.getMyYearly(2025).subscribe();
    const req = httpMock.expectOne(`${base}/salary/me/yearly/2025`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getHousehold calls GET /salary/household', () => {
    service.getHousehold().subscribe();
    const req = httpMock.expectOne(`${base}/salary/household`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getByMonth calls GET /salary/household/:year/:month', () => {
    service.getByMonth(2025, 12).subscribe();
    const req = httpMock.expectOne(`${base}/salary/household/2025/12`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
