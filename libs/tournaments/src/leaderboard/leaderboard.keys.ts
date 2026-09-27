/**
 * Both keys carry the {tournamentId} hash tag so they land on the same Redis
 * Cluster slot — the live leaderboard's Lua script (EVAL) requires co-located keys.
 */
export function leaderboardKey(tournamentId: string): string {
  return `tournament:{${tournamentId}}:leaderboard`;
}

export function appliedBetsKey(tournamentId: string): string {
  return `tournament:{${tournamentId}}:applied`;
}

/** One cursor for all boards: how far the ledger has been replayed into Redis. */
export function replayCursorKey(): string {
  return 'leaderboard:replay-cursor';
}
