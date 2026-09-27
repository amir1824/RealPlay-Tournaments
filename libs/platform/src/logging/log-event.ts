export type LogValue = string | number | boolean | undefined;

// eslint-disable-next-line no-control-regex
const UNSAFE_VALUE = /[\s="\\\u0000-\u001f\u007f]/;

/**
 * One logfmt line, `event=<name> key=value ...`, leaving out undefined fields.
 * Values with spaces, quotes, `=` or control characters are JSON-quoted, so a
 * client-supplied id can never forge extra fields or extra lines.
 */
export function logEvent(event: string, fields: Record<string, LogValue> = {}): string {
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  return [`event=${event}`, ...pairs].join(' ');
}

function formatValue(value: LogValue): string {
  const text = String(value);
  if (text === '' || UNSAFE_VALUE.test(text)) return JSON.stringify(text);
  return text;
}
