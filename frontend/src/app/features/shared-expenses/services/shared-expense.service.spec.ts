import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SharedExpenseService } from './shared-expense.service';
import { environment } from '../../../environments/environment';

describe('SharedExpenseService', () => {
  let service: SharedExpenseService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SharedExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list calls GET /expenses/shared with optional params', () => {
    service.list(5, 2025).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/expenses/shared`);
    expect(req.request.params.get('month')).toBe('5');
    req.flush([]);
  });

  it('get calls GET /expenses/shared/:id', () => {
    service.get('exp-1').subscribe();
    httpMock.expectOne(`${base}/expenses/shared/exp-1`).flush({});
  });

  it('proposeCreate calls POST /expenses/shared', () => {
    const dto = { name: 'Groceries', amount: 200, category: 'RECURRING' as any, frequency: 'MONTHLY' as any };
    service.proposeCreate(dto).subscribe();
    const req = httpMock.expectOne(`${base}/expenses/shared`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('proposeUpdate calls PUT /expenses/shared/:id', () => {
    service.proposeUpdate('exp-1', { amount: 250 }).subscribe();
    const req = httpMock.expectOne(`${base}/expenses/shared/exp-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('proposeDelete calls DELETE /expenses/shared/:id', () => {
    service.proposeDelete('exp-1').subscribe();
    const req = httpMock.expectOne(`${base}/expenses/shared/exp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
