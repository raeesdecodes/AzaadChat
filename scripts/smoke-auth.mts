// Store + bcrypt smoke for v2 auth (forces the JSON fallback; cleans up after).
process.env.DATABASE_URL = '';

const { getStore } = await import('../lib/store');
const { default: bcrypt } = await import('bcryptjs');
const fs = (await import('fs')).promises;
const path = (await import('path')).default;

const store = getStore();
const email = `smoke-${Date.now()}@example.com`;
const password = 'smoke-password-123';

const hash = await bcrypt.hash(password, 12);
const created = await store.createUser({ email, passwordHash: hash });
if (!created.id) throw new Error('FAIL: no id returned');

const found = await store.findUserByEmail(email);
if (!found || found.id !== created.id) throw new Error('FAIL: findUserByEmail miss');
if (found.email !== email) throw new Error('FAIL: email mismatch');

const ok = await bcrypt.compare(password, found.passwordHash);
if (!ok) throw new Error('FAIL: bcrypt compare false');

const wrong = await bcrypt.compare('other-password', found.passwordHash);
if (wrong) throw new Error('FAIL: wrong password accepted');

let dupRejected = false;
try {
  await store.createUser({ email, passwordHash: hash });
} catch {
  dupRejected = true;
}
if (!dupRejected) throw new Error('FAIL: duplicate email accepted');

const miss = await store.findUserByEmail(`nobody-${Date.now()}@example.com`);
if (miss !== null) throw new Error('FAIL: unknown email returned a user');

// Cleanup: remove only our smoke user from the JSON store.
const usersFile = path.join(process.cwd(), 'data', 'users.json');
try {
  const users = JSON.parse(await fs.readFile(usersFile, 'utf8')) as {
    email: string;
  }[];
  const kept = users.filter((u) => u.email !== email);
  await fs.writeFile(usersFile, JSON.stringify(kept, null, 2), 'utf8');
} catch {
  // no file / nothing to clean
}

console.log('auth store smoke OK: create/find/bcrypt/dup-reject/unknown-miss');
