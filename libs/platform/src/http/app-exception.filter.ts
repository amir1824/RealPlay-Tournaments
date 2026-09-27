import { STATUS_CODES } from 'http';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { DependencyUnavailableError } from '../errors/dependency-unavailable.error';
import { logEvent } from '../logging/log-event';
import { matchDependencyFailure } from './error-rules';

/**
 * client: the caller's mistake (4xx). server: a deliberate 5xx. dependency:
 * infrastructure is down (503). bug: anything unexpected (500).
 */
type ErrorKind = 'client' | 'server' | 'dependency' | 'bug';

export interface ErrorResponse {
  statusCode: number;
  error?: string;
  message: string | string[];
  requestId: string;
}

interface ResolvedError {
  kind: ErrorKind;
  status: number;
  body: Omit<ErrorResponse, 'requestId'>;
  dependency?: string;
}

const INTERNAL_ERROR_MESSAGE = 'Internal server error';
const FIRST_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * The one place that turns an error into a status, a body and a log line.
 * Nest's own HttpExceptions keep their status and body; dependency failures
 * become 503 (see error-rules.ts); anything else is a 500 that leaks nothing.
 * requestId is in both the body and the log, to find one from the other.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const resolved = resolveError(exception);
    this.log(resolved, exception, request);
    void http
      .getResponse<FastifyReply>()
      .status(resolved.status)
      .send({ ...resolved.body, requestId: request.id });
  }

  private log(resolved: ResolvedError, exception: unknown, request: FastifyRequest): void {
    if (resolved.kind === 'client') return;
    const line = logEvent('http.error', {
      kind: resolved.kind,
      status: resolved.status,
      dependency: resolved.dependency,
      method: request.method,
      path: request.url,
      requestId: request.id,
      error: String(exception),
      cause: causeOf(exception),
    });
    this.logger.error(line, resolved.kind === 'bug' ? stackOf(exception) : undefined);
  }
}

function resolveError(exception: unknown): ResolvedError {
  if (exception instanceof HttpException) return fromHttpException(exception);
  const failure = matchDependencyFailure(exception);
  if (failure) {
    return {
      kind: 'dependency',
      status: failure.status,
      dependency: failure.dependency,
      body: errorBody(failure.status, failure.message),
    };
  }
  const status = HttpStatus.INTERNAL_SERVER_ERROR;
  return { kind: 'bug', status, body: errorBody(status, INTERNAL_ERROR_MESSAGE) };
}

function fromHttpException(exception: HttpException): ResolvedError {
  const status = exception.getStatus();
  const response = exception.getResponse();
  const kind = status >= FIRST_SERVER_ERROR_STATUS ? 'server' : 'client';
  if (typeof response === 'string') return { kind, status, body: errorBody(status, response) };
  return { kind, status, body: { ...errorBody(status, exception.message), ...response } };
}

function errorBody(status: number, message: string): Omit<ErrorResponse, 'requestId'> {
  return { statusCode: status, error: STATUS_CODES[status], message };
}

function causeOf(exception: unknown): string | undefined {
  if (!(exception instanceof DependencyUnavailableError)) return undefined;
  return String(exception.cause);
}

function stackOf(exception: unknown): string | undefined {
  if (!(exception instanceof Error)) return undefined;
  return exception.stack;
}
