import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { HasNoControlCharacters } from '@app/platform/validation/has-no-control-characters';
import { IsStrictRFC3339 } from '@app/platform/validation/is-strict-rfc3339';
import { IsAfter } from './is-after.validator';

const MAX_NAME_LENGTH = 200;

export class CreateTournamentDto {
  /** Surrounding whitespace is trimmed. */
  @Transform(({ value }) => trimName(value as unknown))
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  @HasNoControlCharacters()
  name!: string;

  /** Start of the eligibility window, inclusive (RFC 3339). */
  @IsStrictRFC3339()
  startsAt!: string;

  /** End of the eligibility window, inclusive. Final placements follow after a short grace. */
  @IsStrictRFC3339()
  @IsAfter('startsAt', { message: 'endsAt must be after startsAt' })
  endsAt!: string;
}

function trimName(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim();
}
