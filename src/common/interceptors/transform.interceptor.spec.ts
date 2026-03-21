import { Test, TestingModule } from '@nestjs/testing';
import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform data into data property', (done) => {
    const mockData = { id: 1, name: 'test' };
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };
    const mockRequest = {
      headers: {},
      url: '/test',
      method: 'GET',
    };
    const mockContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    } as unknown as ExecutionContext;

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result.data).toEqual(mockData);
      expect(result.requestId).toBe('mock-uuid');
      done();
    });
  });
});
