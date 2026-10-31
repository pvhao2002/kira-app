// Creates (or resets the password of) an admin account; the email must also be in ADMIN_EMAILS.
// Usage: ADMIN_PASSWORD=... node scripts/create-admin.ts <email> "<name>" [--remote]
import { execFileSync } from 'node:child_process';
import { hashPassword } from '../worker/password.ts';

const [email, name, target = '--local'] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD ?? '';
if (!email?.includes('@') || !name || password.length < 12 || !['--local', '--remote'].includes(target)) {
  console.error('Usage: ADMIN_PASSWORD=<12+ chars> node scripts/create-admin.ts <email> "<name>" [--local|--remote]');
  process.exit(1);
}
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (email, name, password_hash) VALUES (${q(email.toLowerCase())}, ${q(name)}, ${q(await hashPassword(password))})
  ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash;`;
execFileSync('npx', ['wrangler', 'd1', 'execute', 'knowstack', target, '--command', sql], { stdio: 'inherit' });
console.log(`Admin ${email} ready. Make sure it is listed in ADMIN_EMAILS.`);
