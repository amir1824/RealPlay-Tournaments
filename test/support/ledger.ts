import { TestApp } from './test-app';

export function countTournamentBets(testApp: TestApp, tournamentId: string): Promise<number> {
  return testApp.prisma.tournamentBet.count({ where: { tournamentId } });
}
