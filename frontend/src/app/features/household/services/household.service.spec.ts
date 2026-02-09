import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HouseholdService } from './household.service';
import { environment } from '../../../environments/environment';

describe('HouseholdService', () => {
  let service: HouseholdService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HouseholdService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMine calls GET /household/mine', () => {
    service.getMine().subscribe();
    const req = httpMock.expectOne(`${base}/household/mine`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create calls POST /household', () => {
    service.create({ name: 'Test' }).subscribe();
    const req = httpMock.expectOne(`${base}/household`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Test' });
    req.flush({});
  });

  it('joinByCode calls POST /household/join', () => {
    service.joinByCode({ inviteCode: 'ABC123' }).subscribe();
    const req = httpMock.expectOne(`${base}/household/join`);
    expect(req.request.body).toEqual({ inviteCode: 'ABC123' });
    req.flush({});
  });

  it('regenerateCode calls POST /household/regenerate-code', () => {
    service.regenerateCode().subscribe();
    httpMock.expectOne(`${base}/household/regenerate-code`).flush({});
  });

  it('leave calls POST /household/leave', () => {
    service.leave().subscribe();
    httpMock.expectOne(`${base}/household/leave`).flush({});
  });

  it('removeMember calls DELETE /household/members/:id', () => {
    service.removeMember('user-1').subscribe();
    const req = httpMock.expectOne(`${base}/household/members/user-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('transferOwnership calls POST /household/transfer-ownership', () => {
    service.transferOwnership({ targetUserId: 'user-2' }).subscribe();
    const req = httpMock.expectOne(`${base}/household/transfer-ownership`);
    expect(req.request.body).toEqual({ targetUserId: 'user-2' });
    req.flush({});
  });
});
