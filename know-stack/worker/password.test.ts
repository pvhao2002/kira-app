import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'garbage')).toBe(false);
  });
});
