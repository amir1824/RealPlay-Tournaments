import { applyDecorators } from '@nestjs/common';
import { IsISO8601, IsRFC3339, Matches } from 'class-validator';

/**
 * Timestamps are stored to the millisecond, and new Date() drops anything
 * finer: a bet at .000123Z and a tournament starting at .000999Z would both
 * become .000Z, and the bet would count before the start.
 */
const AT_MOST_MILLISECONDS = /^[^.]+(?:\.\d{1,3})?(?:z|[+-]\d{2}:\d{2})$/i;

/**
 * RFC 3339 (explicit offset) on a date that exists, to at most millisecond
 * precision. @IsRFC3339() checks the format only: it passes 2026-02-31, which
 * new Date() rolls over to March 3, and a :60 leap second, which becomes
 * Invalid Date. Strict ISO 8601 rejects both.
 */
export function IsStrictRFC3339(): PropertyDecorator {
  return applyDecorators(
    IsRFC3339(),
    IsISO8601({ strict: true, strictSeparator: true }),
    Matches(AT_MOST_MILLISECONDS, {
      message: '$property must be precise to the millisecond at most',
    }),
  );
}
