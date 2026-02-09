import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InvitationService } from './invitation.service';
import { environment } from '../../../environments/environment';

describe('InvitationService', () => {
  let service: InvitationService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvitationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('invite calls POST /household/invite', () => {
    service.invite({ email: 'a@b.com' }).subscribe();
    const req = httpMock.expectOne(`${base}/household/invite`);
    expect(req.request.body).toEqual({ email: 'a@b.com' });
    req.flush({});
  });

  it('getPending calls GET /household/invitations/pending', () => {
    service.getPending().subscribe();
    const req = httpMock.expectOne(`${base}/household/invitations/pending`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('respond calls POST /household/invitations/:id/respond', () => {
    service.respond('inv-1', { accept: true }).subscribe();
    const req = httpMock.expectOne(`${base}/household/invitations/inv-1/respond`);
    expect(req.request.body).toEqual({ accept: true });
    req.flush({});
  });

  it('cancel calls DELETE /household/invitations/:id', () => {
    service.cancel('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/household/invitations/inv-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
