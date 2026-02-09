import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApprovalService } from './approval.service';
import { environment } from '../../../environments/environment';

describe('ApprovalService', () => {
  let service: ApprovalService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApprovalService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPending calls GET /approvals', () => {
    service.getPending().subscribe();
    const req = httpMock.expectOne(`${base}/approvals`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getHistory calls GET /approvals/history', () => {
    service.getHistory().subscribe();
    httpMock.expectOne(`${base}/approvals/history`).flush([]);
  });

  it('accept calls PUT /approvals/:id/accept with optional dto', () => {
    service.accept('a-1', { message: 'LGTM' }).subscribe();
    const req = httpMock.expectOne(`${base}/approvals/a-1/accept`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ message: 'LGTM' });
    req.flush({});
  });

  it('accept sends empty object when no dto', () => {
    service.accept('a-1').subscribe();
    const req = httpMock.expectOne(`${base}/approvals/a-1/accept`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('reject calls PUT /approvals/:id/reject', () => {
    service.reject('a-1', { message: 'Too expensive' }).subscribe();
    const req = httpMock.expectOne(`${base}/approvals/a-1/reject`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ message: 'Too expensive' });
    req.flush({});
  });
});
