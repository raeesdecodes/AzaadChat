// E2E helper: create or remove the smoke account (JSON fallback only).
// Usage: npx tsx scripts/e2e-user.mts create | cleanup
process.env.DATABASE_URL = '';

const EMAIL = 'e2e-smoke@example.com';
const PASSWORD = 'e2e-password-123';

const mode = process.argv[2];
const { getStore } = await import('../lib/store');
const store = getStore();

if (mode === 'create') {
  const { default: bcrypt } = await import('bcryptjs');
  const existing = await store.findUserByEmail(EMAIL);
  if (!existing) {
    await store.createUser({ email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 12) });
    console.log('created', EMAIL);
  } else {
    console.log('exists', EMAIL);
  }
} else if (mode === 'cleanup') {
  const fs = (await import('fs')).promises;
  const path = (await import('path')).default;
  try {
    const file = path.join(process.cwd(), 'data', 'users.json');
    const users = JSON.parse(await fs.readFile(file, 'utf8')) as { email: string }[];
    await fs.writeFile(
      file,
      JSON.stringify(users.filter((u) => u.email !== EMAIL), null, 2),
      'utf8',
    );
    console.log('cleaned', EMAIL);
  } catch {
    console.log('nothing to clean');
  }
} else {
  throw new Error('usage: create | cleanup');
}
