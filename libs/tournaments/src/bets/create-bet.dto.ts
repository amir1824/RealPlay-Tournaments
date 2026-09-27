import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { POSTGRES_INT_MAX } from '@app/platform/database/postgres-limits';
import { HasNoControlCharacters } from '@app/platform/validation/has-no-control-characters';
import { IsStrictRFC3339 } from '@app/platform/validation/is-strict-rfc3339';

const MAX_ID_LENGTH = 128;

/**
 * " p1 " and "p1" would be two players, and trimming instead would silently
 * rewrite the caller's id, so padded ids are rejected.
 */
const NO_SURROUNDING_WHITESPACE = /^\S(?:.*\S)?$/;
const NO_SURROUNDING_WHITESPACE_MESSAGE = '$property must not start or end with whitespace';

export class CreateBetDto {
  /** The caller's id for this bet; it counts at most once per tournament. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  @Matches(NO_SURROUNDING_WHITESPACE, { message: NO_SURROUNDING_WHITESPACE_MESSAGE })
  @HasNoControlCharacters()
  externalBetId!: string;

  /** The score is summed per playerId. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ID_LENGTH)
  @Matches(NO_SURROUNDING_WHITESPACE, { message: NO_SURROUNDING_WHITESPACE_MESSAGE })
  @HasNoControlCharacters()
  playerId!: string;

  /** Cents: 250 is $2.50. */
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INT_MAX)
  amount!: number;

  /**
   * ISO 4217 code, stored upper-cased: the validator accepts "usd" too, and a
   * retry in another case must not read as a different bet.
   */
  @Transform(({ value }) => upperCase(value as unknown))
  @IsISO4217CurrencyCode({ message: 'currency must be an ISO-4217 code, e.g. USD' })
  currency!: string;

  /**
   * Event time, which decides eligibility. RFC 3339 with an explicit offset,
   * so it never depends on the server's timezone.
   */
  @IsStrictRFC3339()
  createdAt!: string;
}

function upperCase(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.toUpperCase();
}
