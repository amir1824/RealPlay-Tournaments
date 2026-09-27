export function iso(offsetMs: number, from: number = Date.now()): string {
  return new Date(from + offsetMs).toISOString();
}
