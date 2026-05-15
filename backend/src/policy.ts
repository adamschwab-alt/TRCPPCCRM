import { prisma } from "./db";

// A tiny built-in blocklist of common passwords. In production replace
// with a real source (e.g. haveibeenpwned k-anonymity API).
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty", "qwerty123", "abc12345", "letmein", "welcome", "welcome1",
  "redland", "redland1", "redland2026", "redland2026!", "admin", "admin123",
  "iloveyou", "monkey", "dragon", "sunshine", "princess", "football", "baseball",
]);

export interface PasswordPolicy {
  minLength: number;
  requireMixed: boolean;
}

export async function getPolicy(): Promise<PasswordPolicy> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["password_min_length", "password_require_mixed"] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    minLength: Math.max(8, parseInt(map.password_min_length || "8", 10)),
    requireMixed: map.password_require_mixed === "true",
  };
}

export async function validatePassword(pwd: string): Promise<string | null> {
  const policy = await getPolicy();
  if (typeof pwd !== "string") return "Password is required.";
  if (pwd.length < policy.minLength) return `Password must be at least ${policy.minLength} characters.`;
  if (pwd.length > 200) return "Password is too long.";
  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) {
    return "That password is too common. Please choose a stronger one.";
  }
  if (policy.requireMixed) {
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
    if (variety < 3) {
      return "Password must include at least 3 of: lowercase, uppercase, digit, symbol.";
    }
  }
  return null;
}
