import { createHmac, timingSafeEqual } from "node:crypto";

const secretNamePattern = /^[A-Z][A-Z0-9_]{2,99}$/;

export function getNamedServerSecret(name: string) {
  if (!secretNamePattern.test(name)) return null;
  return process.env[name]?.trim() || null;
}

export function secureStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyFacebookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return secureStringEqual(signatureHeader, expected);
}
