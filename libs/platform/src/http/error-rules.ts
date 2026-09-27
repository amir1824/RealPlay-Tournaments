import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DependencyUnavailableError } from '../errors/dependency-unavailable.error';

export interface DependencyFailure {
  dependency: string;
  status: HttpStatus;
  message: string;
}

/**
 * One row per failure shape: which dependency it means, and the status the
 * client gets. First match wins. A new mapping is a new row.
 */
interface ErrorRule {
  dependencyOf: (error: unknown) => string | undefined;
  status: HttpStatus;
}

/**
 * Prisma codes for "the database is unreachable or saturated", not "the query
 * is wrong". Prisma exports no constants for them; they are a documented
 * contract: https://www.prisma.io/docs/orm/reference/error-reference
 */
const POSTGRES_UNAVAILABLE_CODES: ReadonlyMap<string, string> = new Map([
  ['P1001', "can't reach database server"],
  ['P1002', 'database server timed out'],
  ['P1008', 'operation timed out'],
  ['P1017', 'server closed the connection'],
  ['P2024', 'no pool connection in time'],
  ['P2028', 'no transaction in time'],
]);
const NETWORK_ERROR_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH']);
/**
 * ioredis 5 fails a command with one of these once the connection is gone,
 * or when it outlives commandTimeout (see redis.module.ts).
 */
const REDIS_ERROR_NAME = 'MaxRetriesPerRequestError';
const REDIS_FAILURE_MESSAGES = new Set(['Connection is closed.', 'Command timed out']);

const ERROR_RULES: ErrorRule[] = [
  {
    dependencyOf: (error) =>
      error instanceof DependencyUnavailableError ? error.dependency : undefined,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  {
    dependencyOf: (error) => (isPostgresUnavailable(error) ? 'postgres' : undefined),
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  {
    dependencyOf: (error) => (isRedisUnavailable(error) ? 'redis' : undefined),
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  {
    dependencyOf: (error) => (isNetworkError(error) ? 'network' : undefined),
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
];

export function matchDependencyFailure(error: unknown): DependencyFailure | undefined {
  for (const rule of ERROR_RULES) {
    const dependency = rule.dependencyOf(error);
    if (dependency)
      return { dependency, status: rule.status, message: `${dependency} unavailable` };
  }
  return undefined;
}

function isPostgresUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    POSTGRES_UNAVAILABLE_CODES.has(error.code)
  );
}

function isRedisUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === REDIS_ERROR_NAME || REDIS_FAILURE_MESSAGES.has(error.message);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code: unknown = Reflect.get(error, 'code');
  return typeof code === 'string' && NETWORK_ERROR_CODES.has(code);
}
