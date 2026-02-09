import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('get', () => {
    it('should call GET with correct URL', () => {
      service.get('/test').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/test`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('should forward HttpParams', () => {
      const params = new HttpParams().set('month', '1').set('year', '2025');
      service.get('/test', params).subscribe();
      const req = httpMock.expectOne(r => r.url === `${baseUrl}/test`);
      expect(req.request.params.get('month')).toBe('1');
      expect(req.request.params.get('year')).toBe('2025');
      req.flush({});
    });
  });

  describe('post', () => {
    it('should call POST with correct URL and body', () => {
      const body = { name: 'test' };
      service.post('/items', body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/items`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({});
    });
  });

  describe('put', () => {
    it('should call PUT with correct URL and body', () => {
      const body = { amount: 100 };
      service.put('/items/1', body).subscribe();
      const req = httpMock.expectOne(`${baseUrl}/items/1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(body);
      req.flush({});
    });

    it('should forward HttpParams', () => {
      const params = new HttpParams().set('month', '3');
      service.put('/salary', { amount: 50 }, params).subscribe();
      const req = httpMock.expectOne(r => r.url === `${baseUrl}/salary`);
      expect(req.request.params.get('month')).toBe('3');
      req.flush({});
    });
  });

  describe('delete', () => {
    it('should call DELETE with correct URL', () => {
      service.delete('/items/1').subscribe();
      const req = httpMock.expectOne(`${baseUrl}/items/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });
});
