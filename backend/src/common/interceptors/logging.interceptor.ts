import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const now = Date.now();

    this.logger.log(`→ ${method} ${url}`);

    if (Object.keys(query).length > 0) {
      this.logger.debug(`Query: ${JSON.stringify(query)}`);
    }
    if (Object.keys(params).length > 0) {
      this.logger.debug(`Params: ${JSON.stringify(params)}`);
    }
    if (body && Object.keys(body).length > 0) {
      this.logger.debug(`Body: ${JSON.stringify(body)}`);
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const delay = Date.now() - now;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} (${delay}ms)`,
          );
        },
        error: (error) => {
          const delay = Date.now() - now;
          this.logger.error(
            `✗ ${method} ${url} (${delay}ms) - ${error.message}`,
          );
        },
      }),
      catchError((error) => {
        if (error instanceof BadRequestException) {
          const response = error.getResponse();
          this.logger.error(
            `Validation error for ${method} ${url}: ${JSON.stringify(response, null, 2)}`,
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
