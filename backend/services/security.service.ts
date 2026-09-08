import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../config/prisma";
import { JWT_SECRET, SALT_ROUNDS } from "../utils/constants";

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;

const encryptionKey = () =>
  crypto
    .createHash("sha256")
    .update(process.env.SECURITY_ENCRYPTION_KEY || JWT_SECRET)
    .digest();

const base32Encode = (bytes: Buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (value: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let current = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
};

const encrypt = (value: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
};

const decrypt = (value: string) => {
  const [ivEncoded, tagEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error("Invalid encrypted TOTP secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, "base64url")), decipher.final()]).toString("utf8");
};

const totpCode = (secret: string, timestamp = Date.now()) => {
  const counter = Math.floor(timestamp / 1000 / TOTP_STEP_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
};

const verifyTotpCode = (secret: string, code: string) => {
  if (!/^\d{6}$/.test(code)) return false;
  const now = Date.now();
  return [-1, 0, 1].some((offset) => totpCode(secret, now + offset * TOTP_STEP_SECONDS * 1000) === code);
};

const normalizePhone = (phone: string) => phone.trim().replace(/[\s().-]/g, "");
const newRecoveryCode = () => {
  const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
};

type SecurityRow = {
  totpEnabled: boolean;
  recoveryPhone: string | null;
  recoveryPhoneVerifiedAt: Date | null;
};

export const securityService = {
  async getStatus(userId: string) {
    const rows = await prisma.$queryRaw<SecurityRow[]>`
      SELECT "totpEnabled", "recoveryPhone", "recoveryPhoneVerifiedAt"
      FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const user = rows[0];
    if (!user) throw new Error("User not found");
    const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "RecoveryCode"
      WHERE "userId" = ${userId} AND "usedAt" IS NULL
    `;
    return {
      totpEnabled: user.totpEnabled,
      recoveryPhone: user.recoveryPhone,
      recoveryPhoneVerified: Boolean(user.recoveryPhoneVerifiedAt),
      recoveryCodesRemaining: Number(countRows[0]?.count || 0),
    };
  },

  async beginTotpSetup(userId: string, accountLabel: string) {
    const secret = base32Encode(crypto.randomBytes(20));
    await prisma.$executeRaw`
      UPDATE "User" SET "totpPendingSecret" = ${encrypt(secret)}, "totpPendingCreatedAt" = NOW()
      WHERE "id" = ${userId}
    `;
    const issuer = encodeURIComponent("ATARA");
    const label = encodeURIComponent(accountLabel || "Compte ATARA");
    return { secret, otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` };
  },

  async enableTotp(userId: string, code: string) {
    const rows = await prisma.$queryRaw<Array<{ totpPendingSecret: string | null; totpPendingCreatedAt: Date | null }>>`
      SELECT "totpPendingSecret", "totpPendingCreatedAt" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const user = rows[0];
    if (!user?.totpPendingSecret || !user.totpPendingCreatedAt || Date.now() - user.totpPendingCreatedAt.getTime() > 10 * 60 * 1000) throw new Error("TOTP setup has expired");
    if (!verifyTotpCode(decrypt(user.totpPendingSecret), code)) throw new Error("Invalid authenticator code");
    await prisma.$executeRaw`
      UPDATE "User" SET "totpSecretEncrypted" = "totpPendingSecret", "totpPendingSecret" = NULL, "totpPendingCreatedAt" = NULL, "totpEnabled" = TRUE
      WHERE "id" = ${userId}
    `;
    return { enabled: true };
  },

  async disableTotp(userId: string, code: string) {
    const rows = await prisma.$queryRaw<Array<{ totpSecretEncrypted: string | null; totpEnabled: boolean }>>`
      SELECT "totpSecretEncrypted", "totpEnabled" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const user = rows[0];
    if (!user?.totpEnabled || !user.totpSecretEncrypted) throw new Error("TOTP is not enabled");
    if (!verifyTotpCode(decrypt(user.totpSecretEncrypted), code)) throw new Error("Invalid authenticator code");
    await prisma.$executeRaw`UPDATE "User" SET "totpSecretEncrypted" = NULL, "totpEnabled" = FALSE WHERE "id" = ${userId}`;
    return { enabled: false };
  },

  async regenerateRecoveryCodes(userId: string) {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    await prisma.$executeRaw`DELETE FROM "RecoveryCode" WHERE "userId" = ${userId}`;
    for (const code of codes) {
      await prisma.$executeRaw`
        INSERT INTO "RecoveryCode" ("id", "userId", "codeHash")
        VALUES (${crypto.randomUUID()}, ${userId}, ${await bcrypt.hash(code, SALT_ROUNDS)})
      `;
    }
    return codes;
  },

  async consumeRecoveryCode(userId: string, rawCode: string) {
    const candidates = await prisma.$queryRaw<Array<{ id: string; codeHash: string }>>`
      SELECT "id", "codeHash" FROM "RecoveryCode" WHERE "userId" = ${userId} AND "usedAt" IS NULL
    `;
    for (const candidate of candidates) {
      if (await bcrypt.compare(rawCode.trim().toUpperCase(), candidate.codeHash)) {
        await prisma.$executeRaw`UPDATE "RecoveryCode" SET "usedAt" = NOW() WHERE "id" = ${candidate.id} AND "usedAt" IS NULL`;
        return true;
      }
    }
    return false;
  },

  async saveRecoveryPhone(userId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("Use an international phone number, for example +33612345678");
    await prisma.$executeRaw`UPDATE "User" SET "recoveryPhone" = ${normalized}, "recoveryPhoneVerifiedAt" = NULL WHERE "id" = ${userId}`;
    return { phone: normalized, verified: false, providerRequired: true };
  },
};
