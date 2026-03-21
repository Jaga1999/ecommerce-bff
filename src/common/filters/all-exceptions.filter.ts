import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../dto/api-response.dto';
import { v4 as uuidv4 } from 'uuid';

interface HttpExceptionResponse {
  message: string | string[];
  details?: any[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: boolean | null = null;
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse() as HttpExceptionResponse;

      if (typeof responseBody === 'object' && responseBody !== null) {
        if (Array.isArray(responseBody.message)) {
          message = 'Validation failed';
          error = true;
          details = [message, responseBody.message];
        } else {
          message = responseBody.message || exception.message;
          error = true;
          details = [message, responseBody.details || []];
        }
      } else {
        message =
          typeof responseBody === 'string' ? responseBody : exception.message;
        error = true;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = true;
      details = [message, ...(exception.stack ? [exception.stack] : [])];
    } else {
      error = true;
    }

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const startTime = request.startTime || Date.now();
    const timetakenms = Date.now() - startTime;

    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    const errorResponse = new ApiResponse<null>(
      null,
      timetakenms,
      requestId,
      request.url,
      error ? true : null,
      error ? (details.length > 0 ? details : null) : null,
    );

    response.status(status).json(errorResponse);
  }
}
