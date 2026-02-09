import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';
import { environment } from '../../../environments/environment';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getOverview sends GET to /dashboard', () => {
    service.getOverview().subscribe();
    const req = httpMock.expectOne(`${base}/dashboard`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('markSettlementPaid sends POST to /dashboard/settlement/mark-paid', () => {
    service.markSettlementPaid().subscribe();
    const req = httpMock.expectOne(`${base}/dashboard/settlement/mark-paid`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
