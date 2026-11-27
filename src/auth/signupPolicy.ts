// Mirrors CarelogRegistrationCoordinator.validatePassword in platform-core:
// 8-20 Unicode code points, no ISO control characters, at most 72 UTF-8 bytes.
// The password is never trimmed (trim applies to userId, email and name only).
export const SIGNUP_PASSWORD_MIN_CODE_POINTS = 8;
export const SIGNUP_PASSWORD_MAX_CODE_POINTS = 20;
export const SIGNUP_PASSWORD_MAX_UTF8_BYTES = 72;

export type SignupPasswordProblem = 'length' | 'characters' | 'bytes';

export function findSignupPasswordProblem(password: string): SignupPasswordProblem | null {
  const codePoints = [...password].map((char) => char.codePointAt(0) ?? 0);
  if (
    codePoints.length < SIGNUP_PASSWORD_MIN_CODE_POINTS ||
    codePoints.length > SIGNUP_PASSWORD_MAX_CODE_POINTS
  ) {
    return 'length';
  }
  if (codePoints.some((cp) => cp <= 0x1f || (cp >= 0x7f && cp <= 0x9f))) return 'characters';
  try {
    // encodeURIComponent throws on lone surrogates; Core rejects malformed UTF-16 too.
    encodeURIComponent(password);
  } catch {
    return 'characters';
  }
  if (new TextEncoder().encode(password).length > SIGNUP_PASSWORD_MAX_UTF8_BYTES) return 'bytes';
  return null;
}
