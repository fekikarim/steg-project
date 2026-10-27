import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { ToastService } from '../shared/ui/toast.service';
import { AuthService } from './auth.service';
import { of } from 'rxjs';

import { vi } from 'vitest';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockRouter: any;
  let mockToast: any;
  let mockAuthService: any;

  beforeEach(() => {
    mockRouter = { navigate: vi.fn(), url: '/dashboard' };
    mockToast = { show: vi.fn() };
    mockAuthService = { getRefreshToken: vi.fn(), refresh: vi.fn(), getAccessToken: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
        { provide: AuthService, useValue: mockAuthService },
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting()
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should redirect to /change-password on 403 PASSWORD_CHANGE_REQUIRED', () => {
    httpClient.get('/api/test').subscribe({
      next: () => expect.fail('should have failed with 403 error'),
      error: (error) => {
        expect(error.status).toBe(403);
      }
    });

    const req = httpMock.expectOne('/api/test');
    req.flush({ message: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403, statusText: 'Forbidden' });

    expect(mockToast.show).toHaveBeenCalledWith('warning', 'Vous devez modifier votre mot de passe.');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/change-password']);
  });

  it('does not loop when the failing request is the change-password call itself', () => {
    // The user is already on the change-password screen and the POST
    // /api/auth/change-password is refused with 403 PASSWORD_CHANGE_REQUIRED
    // (e.g. the current password is wrong). The interceptor must not navigate
    // again — otherwise the page reloads and the user loses the form.
    mockRouter.url = '/change-password';
    mockAuthService.getRefreshToken.mockReturnValue('refresh-token');

    httpClient.post('/api/auth/change-password', {}).subscribe({
      next: () => expect.fail('should have failed with 403 error'),
      error: (error) => {
        expect(error.status).toBe(403);
      }
    });

    const req = httpMock.expectOne('/api/auth/change-password');
    req.flush({ message: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403, statusText: 'Forbidden' });

    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToast.show).not.toHaveBeenCalled();
  });
});
