import { hash, compare } from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export class EmailPasswordProvider {
  async hashPassword(password: string): Promise<string> {
    return hash(password, BCRYPT_ROUNDS);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  validatePassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters' };
    if (password.length > 128) return { valid: false, message: 'Password must be at most 128 characters' };
    return { valid: true };
  }

  validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
