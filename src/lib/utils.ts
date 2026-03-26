import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { randomInt } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a cryptographically secure temporary password.
 * 14 chars: uppercase, lowercase, numbers, special chars.
 * Used for initial technician invites; users must change on first login.
 *
 * Uses crypto.randomInt() which performs rejection sampling internally,
 * ensuring uniform distribution across the character set (no modulo bias).
 */
export function generateTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const special = '!@#$%^&*-_=+' // Avoid problematic chars like quotes/backslash

  const chars = upper + lower + nums + special

  let password = ''
  for (let i = 0; i < 14; i++) {
    password += chars[randomInt(chars.length)]
  }

  return password
}
