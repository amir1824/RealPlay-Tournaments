import { execSync } from 'child_process';

/** Applies migrations to the test database once per run, so `pnpm test` needs
 * nothing beyond `docker compose up -d`. DATABASE_URL comes from .env.test,
 * which `pnpm test` loads via dotenv-cli before Jest starts. */
export default function globalSetup(): void {
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe' });
}
