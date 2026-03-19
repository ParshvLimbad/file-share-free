import { SHARE_CODE_LENGTH, SHARE_CODE_CHARS } from './constants';

export function generateShareCode(): string {
  let code = '';
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_CHARS.charAt(
      Math.floor(Math.random() * SHARE_CODE_CHARS.length)
    );
  }
  return code;
}

export function isValidShareCode(code: string): boolean {
  if (code.length !== SHARE_CODE_LENGTH) return false;
  for (const char of code) {
    if (!SHARE_CODE_CHARS.includes(char)) return false;
  }
  return true;
}
