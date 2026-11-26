import {passwordErrors} from './account.page';

describe('passwordErrors', () => {
  it('accepts a new password of 8 characters up to 72 bytes, typed twice', () => {
    expect(passwordErrors('mat-khau-moi', 'mat-khau-moi', 'mat-khau-cu')).toEqual({});
    expect(passwordErrors('12345678', '12345678')).toEqual({});
    expect(passwordErrors('x'.repeat(72), 'x'.repeat(72))).toEqual({});
  });

  it('rejects a new password that is too short or longer than bcrypt reads (72 bytes)', () => {
    expect(passwordErrors('1234567', '1234567').next).toBeTruthy();
    expect(passwordErrors('x'.repeat(73), 'x'.repeat(73)).next).toBeTruthy();
    // Letters with diacritics take 2-3 bytes each.
    expect(passwordErrors('ă'.repeat(37), 'ă'.repeat(37)).next).toBeTruthy();
  });

  it('asks for the repeat to match, and only once the new password itself is fine', () => {
    expect(passwordErrors('12345678', '12345679').repeat).toBeTruthy();
    expect(passwordErrors('12345678', '').repeat).toBeTruthy();
    expect(passwordErrors('short', 'other').repeat).toBeUndefined();
  });

  it('needs the current password, and a new one that differs from it', () => {
    expect(passwordErrors('12345678', '12345678', '').current).toBeTruthy();
    expect(passwordErrors('12345678', '12345678', '12345678').next).toBeTruthy();
  });

  it('does not ask for a current password when resetting the other account', () => {
    expect(passwordErrors('12345678', '12345678', undefined).current).toBeUndefined();
  });
});
