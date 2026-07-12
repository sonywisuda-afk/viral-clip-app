import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });

// Milestone 5C-B - the only way to grant ADMIN/AI_ENGINEER/OPERATOR (see
// UserRole in schema.prisma). Deliberately no self-service HTTP endpoint for
// this - that would itself be a privilege-escalation hole. See
// docs/operations-runbook.md.
//
// Usage: pnpm --filter @speedora/api grant-role -- user@example.com ADMIN
async function main() {
  const [email, role] = process.argv.slice(2);
  const validRoles = ['CREATOR', 'ADMIN', 'AI_ENGINEER', 'OPERATOR'];
  if (!email || !role || !validRoles.includes(role)) {
    console.error(`Usage: grant-role <email> <${validRoles.join('|')}>`);
    process.exit(1);
  }

  const { PrismaClient, PrismaPg } = await import('@speedora/database');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const user = await prisma.user.update({
    where: { email },
    data: { role: role as never },
  });
  console.log(`Granted ${user.role} to ${user.email} (${user.id}).`);

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[grant-role] failed:', error);
    process.exit(1);
  });
}
