import { execFileSync } from 'node:child_process';

const scripts = [
  'seed.ts',
  'seed-ingredients.ts',
  'seed-promotions.ts',
  'seed-admin.ts',
];

for (const script of scripts) {
  console.log(`\n=== Running ${script} ===`);
  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'tsx', `prisma/${script}`], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}

if (process.env.SEED_REWARDS_TEST === 'true') {
  console.log('\n=== Running seed-rewards-test.ts ===');
  execFileSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'tsx', 'prisma/seed-rewards-test.ts'],
    { cwd: process.cwd(), stdio: 'inherit' },
  );
}

console.log('\nAll BrewLite seed data completed.');
