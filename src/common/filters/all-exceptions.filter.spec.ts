import { Test, TestingModule } from '@nestjs/testing';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';

jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const mockRequest = {
    url: '/test',
    method: 'GET',
    headers: {},
    startTime: Date.now(),
  } as unknown as Request;

  const mockArgumentsHost = {
    switchToHttp: jest.fn().mockReturnThis(),
    getResponse: jest.fn().mockReturnValue(mockResponse),
    getRequest: jest.fn().mockReturnValue(mockRequest),
  } as unknown as ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AllExceptionsFilter],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  describe('catch', () => {
    it('should handle HttpException with string response', () => {
      const exception = new HttpException(
        'Test Exception',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          path: '/test',
        }),
      );
    });

    it('should handle HttpException with object response and validation errors', () => {
      const responseBody = {
        message: ['email must be an email', 'password is too short'],
        error: 'Bad Request',
      };
      const exception = new HttpException(responseBody, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          details: expect.arrayContaining(['Validation failed']),
        }),
      );
    });

    it('should handle standard Error', () => {
      const exception = new Error('Unexpected Error');

      filter.catch(exception, mockArgumentsHost);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
        }),
      );
    });

    it('should handle unknown exception', () => {
      const exception = 'Unknown string exception';

      filter.catch(exception, mockArgumentsHost);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
        }),
      );
    });
  });
});
