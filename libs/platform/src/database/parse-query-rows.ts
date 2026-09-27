import { z } from 'zod';

/**
 * `$queryRaw<T>` trusts the caller. These check the driver rows before a
 * domain type leaves the repository, and an empty result is undefined.
 */
export function parseQueryRows<T>(rows: unknown, schema: z.ZodType<T>, queryName: string): T[] {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) {
    throw new Error(`Query ${queryName} returned an unexpected row: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function parseFirstQueryRow<T>(
  rows: unknown,
  schema: z.ZodType<T>,
  queryName: string,
): T | undefined {
  return parseQueryRows(rows, schema, queryName)[0];
}
