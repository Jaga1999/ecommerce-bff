import { Test, TestingModule } from '@nestjs/testing';
import { SessionGuard } from './session.guard';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionProperties } from '../../config/properties/session.properties';
import { Cache } from 'cache-manager';

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let cacheManager: Cache;
  let reflector: Reflector;

  const mockSessionProps = {
    cookieName: 'SESSION_ID',
    idHeader: 'X-Session-ID',
  } as SessionProperties;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionGuard,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: SessionProperties,
          useValue: mockSessionProps,
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SessionGuard>(SessionGuard);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true if public metadata is set', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should return true if session is valid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const mockRequest: any = {
        cookies: { SESSION_ID: 'valid-session' },
        header: jest.fn().mockReturnValue(null),
      };
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnThis(),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      } as unknown as ExecutionContext;

      const getSpy = jest
        .spyOn(cacheManager, 'get')
        .mockResolvedValue({ user: { id: 'u1' } });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(getSpy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(mockRequest.user).toBeDefined();
    });

    it('should return false if session is invalid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnThis(),
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/',
          cookies: { SESSION_ID: 'invalid-session' },
          header: jest.fn().mockReturnValue(null),
        }),
      } as unknown as ExecutionContext;

      const getSpy = jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await guard.canActivate(context);
      expect(result).toBe(false);
      expect(getSpy).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no session cookie', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnThis(),
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          url: '/',
          cookies: {},
          header: jest.fn().mockReturnValue(null),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
