// Generate a unique 6-character code for file sharing

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateShareCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

export function isValidShareCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}
