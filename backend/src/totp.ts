import { generateSecret as otpGenerateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

const ISSUER = "Redland CRM";

export function generateSecret(): string {
  return otpGenerateSecret({ length: 20 });
}

export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const clean = token.replace(/\s/g, "");
    const result = await verify({
      token: clean,
      secret,
      epochTolerance: [30, 30],
    });
    return !!result.valid;
  } catch {
    return false;
  }
}

export async function provisioningQR(args: {
  secret: string;
  accountLabel: string;
}): Promise<{ otpauth: string; qrDataUrl: string }> {
  const otpauth = generateURI({
    issuer: ISSUER,
    label: args.accountLabel,
    secret: args.secret,
  });
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  return { otpauth, qrDataUrl };
}
