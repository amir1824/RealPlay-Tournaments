import { z } from 'zod';

export interface AppConfig {
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  finalizationGraceMs: number;
  redisCommandTimeoutMs: number;
  openApiEnabled: boolean;
}

const DEFAULT_API_PORT = 3000;
const DEFAULT_FINALIZATION_GRACE_MS = 30000;
const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 1000;

/** `FOO=` in a .env file means "use the default", not 0. */
const blankAsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const intWithDefault = (fallback: number, min: number) =>
  z.preprocess(blankAsUnset, z.coerce.number().int().min(min).default(fallback));

const flagWithDefault = (fallback: 'true' | 'false') =>
  z
    .preprocess(blankAsUnset, z.enum(['true', 'false']).default(fallback))
    .transform((flag) => flag === 'true');

const envSchema = z.object({
  API_PORT: intWithDefault(DEFAULT_API_PORT, 1),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  FINALIZATION_GRACE_MS: intWithDefault(DEFAULT_FINALIZATION_GRACE_MS, 0),
  REDIS_COMMAND_TIMEOUT_MS: intWithDefault(DEFAULT_REDIS_COMMAND_TIMEOUT_MS, 1),
  OPENAPI_ENABLED: flagWithDefault('false'),
});

/**
 * Loads and validates process.env once at boot. Both apps/api and
 * apps/workers use this so configuration cannot silently drift between
 * them (e.g. a different grace period). Every invalid variable is reported
 * at once rather than one per restart.
 */
export function loadAppConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  return {
    apiPort: env.API_PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    finalizationGraceMs: env.FINALIZATION_GRACE_MS,
    redisCommandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
    openApiEnabled: env.OPENAPI_ENABLED,
  };
}
