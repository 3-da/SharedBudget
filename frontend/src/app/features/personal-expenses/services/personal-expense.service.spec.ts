import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PersonalExpenseService } from './personal-expense.service';
import { environment } from '../../../environments/environment';

describe('PersonalExpenseService', () => {
  let service: PersonalExpenseService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PersonalExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('list calls GET /expenses/personal with optional params', () => {
    service.list(3, 2025).subscribe();
    const req = httpMock.expectOne(r => r.url === `${base}/expenses/personal`);
    expect(req.request.params.get('month')).toBe('3');
    expect(req.request.params.get('year')).toBe('2025');
    req.flush([]);
  });

  it('list calls GET without params when none provided', () => {
    service.list().subscribe();
    const req = httpMock.expectOne(`${base}/expenses/personal`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('get calls GET /expenses/personal/:id', () => {
    service.get('exp-1').subscribe();
    httpMock.expectOne(`${base}/expenses/personal/exp-1`).flush({});
  });

  it('create calls POST /expenses/personal', () => {
    const dto = { name: 'Rent', amount: 1000, category: 'RECURRING' as any, frequency: 'MONTHLY' as any };
    service.create(dto).subscribe();
    const req = httpMock.expectOne(`${base}/expenses/personal`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({});
  });

  it('update calls PUT /expenses/personal/:id', () => {
    service.update('exp-1', { name: 'Updated' }).subscribe();
    const req = httpMock.expectOne(`${base}/expenses/personal/exp-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('delete calls DELETE /expenses/personal/:id', () => {
    service.delete('exp-1').subscribe();
    const req = httpMock.expectOne(`${base}/expenses/personal/exp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
