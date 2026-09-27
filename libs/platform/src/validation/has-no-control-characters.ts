import { Matches } from 'class-validator';

const NO_CONTROL_CHARACTERS = /^\P{Cc}*$/u;

/** Postgres rejects NUL in text, so without this check it would surface as a 500, not a 400. */
export function HasNoControlCharacters(): PropertyDecorator {
  return Matches(NO_CONTROL_CHARACTERS, {
    message: '$property must not contain control characters',
  });
}
