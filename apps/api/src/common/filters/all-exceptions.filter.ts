import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || exception.message;
        error = (res.error as string) || 'Error';
      } else {
        message = exception.message;
      }
    } else {
      // Unexpected error — report to Sentry
      const err =
        exception instanceof Error ? exception : new Error(String(exception));

      Sentry.captureException(err, {
        extra: {
          url: request.url,
          method: request.method,
          requestId: request.requestId,
          userId: request.user?.id,
          body: this.sanitizeBody(request.body),
        },
      });

      this.logger.error(
        `Unhandled exception: ${err.message}`,
        err.stack,
      );
    }

    // Log 4xx errors at warn level, 5xx at error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
    });
  }

  private sanitizeBody(body: Record<string, unknown> | undefined) {
    if (!body) return undefined;
    const sanitized = { ...body };
    const sensitiveKeys = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'refreshToken',
    ];
    for (const key of sensitiveKeys) {
      if (key in sanitized) sanitized[key] = '[REDACTED]';
    }
    return sanitized;
  }
}
