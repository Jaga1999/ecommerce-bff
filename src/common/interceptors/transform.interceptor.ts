import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../dto/api-response.dto';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const path = request.url;

    this.logger.debug(
      `Incoming request: ${request.method} ${path} (ID: ${requestId})`,
    );

    return next.handle().pipe(
      tap(() => {
        this.logger.debug(
          `Request ${requestId} processed in ${Date.now() - now}ms`,
        );
      }),
      map(
        (data: T) =>
          new ApiResponse<T>(data, Date.now() - now, requestId, path, null, []),
      ),
    );
  }
}
