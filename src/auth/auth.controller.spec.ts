import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppProperties } from '../config/properties/app.properties';
import { SessionProperties } from '../config/properties/session.properties';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Role } from '../common/enums/role.enum';
import { Response, Request } from 'express';
import { AuthResult, LoginResponse } from './interfaces/auth.interface';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAppProps = {
    dashboardUrl: 'http://dashboard',
    frontendUrl: 'http://frontend',
  } as AppProperties;

  const mockSessionProps = {
    cookieName: 'SESSION_ID',
    idHeader: 'X-Session-ID',
  } as SessionProperties;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            googleLogin: jest.fn(),
            handleCallback: jest.fn(),
            register: jest.fn(),
            createUser: jest.fn(),
            updateUserRole: jest.fn(),
            logout: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
        {
          provide: AppProperties,
          useValue: mockAppProps,
        },
        {
          provide: SessionProperties,
          useValue: mockSessionProps,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and set cookie', async () => {
      const loginDto: LoginDto = { username: 'u', password: 'p' };
      const authResult: AuthResult = {
        sessionId: 's1',
        user: { id: 'u1', username: 'u', email: 'e', roles: [Role.USER] },
      };

      const loginSpy = jest
        .spyOn(authService, 'login')
        .mockResolvedValue(authResult);

      const res = {
        cookie: jest.fn(),
        json: jest.fn(),
      } as unknown as Response;

      const result = await controller.login(loginDto, res);

      expect(loginSpy).toHaveBeenCalledWith(loginDto);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.cookie).toHaveBeenCalledWith(
        'SESSION_ID',
        's1',
        expect.any(Object),
      );
      const expectedResponse: LoginResponse = {
        message: 'logged in successfully',
        user: authResult.user,
      };

      expect(result).toEqual(expectedResponse);
    });
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto: RegisterDto = { username: 'u', email: 'e', password: 'p' };
      const registerSpy = jest
        .spyOn(authService, 'register')
        .mockResolvedValue({ message: 'ok' });

      const result = await controller.register(dto);
      expect(registerSpy).toHaveBeenCalledWith(dto);
      expect(result.message).toBe('ok');
    });
  });

  describe('google', () => {
    it('should call authService.googleLogin and redirect', () => {
      const googleLoginSpy = jest
        .spyOn(authService, 'googleLogin')
        .mockReturnValue({ url: 'http://google' });
      const res = { redirect: jest.fn() } as unknown as Response;

      controller.google(res);

      expect(googleLoginSpy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.redirect).toHaveBeenCalledWith('http://google');
    });
  });

  describe('callback', () => {
    it('should call authService.handleCallback, set cookie and redirect to frontend', async () => {
      const authResult: AuthResult = {
        sessionId: 's1',
        user: { id: 'u1', username: 'u', email: 'e', roles: [Role.USER] },
      };
      const callbackSpy = jest
        .spyOn(authService, 'handleCallback')
        .mockResolvedValue(authResult);
      const res = {
        cookie: jest.fn(),
        redirect: jest.fn(),
      } as unknown as Response;

      await controller.callback('code', res);

      expect(callbackSpy).toHaveBeenCalledWith('code');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.cookie).toHaveBeenCalledWith(
        'SESSION_ID',
        's1',
        expect.any(Object),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.redirect).toHaveBeenCalledWith(mockAppProps.frontendUrl);
    });
  });

  describe('createAdminUser', () => {
    it('should call authService.createUser', async () => {
      const dto: RegisterDto = { username: 'u', email: 'e', password: 'p' };
      const createUserSpy = jest
        .spyOn(authService, 'createUser')
        .mockResolvedValue({ message: 'ok' });

      const result = await controller.createAdminUser(dto, Role.ADMIN);
      expect(createUserSpy).toHaveBeenCalledWith(dto, Role.ADMIN);
      expect(result.message).toBe('ok');
    });
  });

  describe('updateRole', () => {
    it('should call authService.updateUserRole', async () => {
      const updateRoleSpy = jest
        .spyOn(authService, 'updateUserRole')
        .mockResolvedValue({ message: 'ok' });

      const result = await controller.updateRole('u1', Role.ADMIN);
      expect(updateRoleSpy).toHaveBeenCalledWith('u1', Role.ADMIN);
      expect(result.message).toBe('ok');
    });
  });

  describe('logout', () => {
    it('should call authService.logout and clear cookie', async () => {
      const req = {
        cookies: { SESSION_ID: 's1' },
      } as unknown as Request;
      const res = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      const logoutSpy = jest
        .spyOn(authService, 'logout')
        .mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(logoutSpy).toHaveBeenCalledWith('s1');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.clearCookie).toHaveBeenCalledWith('SESSION_ID');
    });
  });

  describe('updateProfile', () => {
    it('should call authService.updateProfile', async () => {
      const dto: UpdateProfileDto = { firstName: 'Jane' };
      const user = { id: 'u1', username: 'u', email: 'e', roles: [Role.USER] };

      const updateSpy = jest
        .spyOn(authService, 'updateProfile')
        .mockResolvedValue({ message: 'ok', user });

      const result = await controller.updateProfile(user, dto);
      expect(updateSpy).toHaveBeenCalledWith(user.id, dto);
      expect(result.message).toBe('ok');
    });
  });
});
