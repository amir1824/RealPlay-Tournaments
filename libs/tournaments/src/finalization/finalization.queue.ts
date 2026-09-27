import { z } from 'zod';

export const FINALIZATION_QUEUE = 'finalization';
export const FINALIZE_TOURNAMENT_JOB = 'finalize-tournament';

/** Deterministic jobId: one snapshot job per tournament, never a duplicate. */
export function finalizationJobId(tournamentId: string): string {
  return `finalize-${tournamentId}`;
}

const finalizeTournamentJobSchema = z.object({
  tournamentId: z.uuid(),
});

export type FinalizeTournamentJobData = z.infer<typeof finalizeTournamentJobSchema>;

/** Queue payloads are JSON from Redis. The generic on Job does not check them. */
export function parseFinalizeTournamentJob(data: unknown): FinalizeTournamentJobData {
  return finalizeTournamentJobSchema.parse(data);
}
