import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { appLogger } from '../logger/app-logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      (request as any).requestId ?? (response.locals as any)?.requestId;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Handle validation errors from class-validator
    let message: any;
    let details: any = undefined;
    if (exception instanceof BadRequestException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        // ValidationPipe returns { message: [...], error: 'Bad Request', statusCode: 400 }
        message = (response as any).message || response;
        if (Array.isArray((response as any).message)) {
          details = { validation: (response as any).message };
        }
      } else {
        message = response;
      }
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      message = (exceptionResponse as any).message || exceptionResponse;
      details = (exceptionResponse as any).details ?? undefined;
    } else {
      message = 'Internal server error';
    }

    const codeFromException =
      (exception as any)?.code ??
      (exceptionResponse as any)?.code ??
      (exceptionResponse as any)?.errorCode ??
      undefined;

    const code =
      codeFromException ??
      (exception instanceof BadRequestException
        ? 'VALIDATION_ERROR'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status >= 500
                ? 'INTERNAL_ERROR'
                : 'HTTP_ERROR');

    const normalizedMessage = Array.isArray(message)
      ? message.join('; ')
      : (message?.message ?? message);

    const envelope = {
      error: {
        code,
        message: normalizedMessage ?? 'Error',
        details,
        requestId,
      },
    };

    // Ensure requestId is present on error responses too
    if (requestId) {
      response.setHeader('x-request-id', requestId);
    }

    const logBase = {
      event: 'http.request.error',
      requestId,
      status,
      method: request.method,
      path: request.originalUrl ?? request.url,
      code,
    };

    if (status >= 500) {
      appLogger.error({
        ...logBase,
        message: normalizedMessage ?? 'Internal error',
        stack: exception instanceof Error ? exception.stack : undefined,
        exception:
          exception instanceof Error ? { name: exception.name } : exception,
      });
    } else {
      appLogger.warn({
        ...logBase,
        message: normalizedMessage ?? 'Request error',
        details,
      });
    }

    response.status(status).json(envelope);
  }
}
