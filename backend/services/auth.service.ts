import crypto from "crypto";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { JWT_SECRET } from "../utils/constants";
import {
  assertAuthMessageMatches,
  type AuthPurpose,
  verifySignature,
} from "../utils/signatureVerifier";

const AUTH_DOMAIN = process.env.AUTH_DOMAIN || "atara.finance";
const AUTH_CHAIN_ID = process.env.ALCHEMY_NETWORK === "base-mainnet" ? 8453 : 84532;
const AUTH_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL = "7d";

class AuthService {
  private generateToken(user: {
    id: string;
    handle: string;
    publicAddress: string;
    smartAccountAddress?: string | null;
    tokenVersion: number;
  }) {
    return jwt.sign(
      {
        id: user.id,
        handle: user.handle,
        address: user.smartAccountAddress,
        tv: user.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_TTL, algorithm: "HS256" },
    );
  }

  public async createChallenge(signerAddress: string, purpose: AuthPurpose) {
    let normalizedAddress: string;
    try {
      normalizedAddress = ethers.utils.getAddress(signerAddress).toLowerCase();
    } catch {
      throw new ErrorHandler("Invalid signer address", 400);
    }

    if (purpose !== "login" && purpose !== "register") {
      throw new ErrorHandler("Invalid authentication purpose", 400);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + AUTH_CHALLENGE_TTL_MS);
    const nonce = crypto.randomBytes(32).toString("hex");
    const purposeLabel = purpose === "login" ? "Login" : "Register";
    const message = [
      "ATARA authentication",
      `Domain: ${AUTH_DOMAIN}`,
      `Chain: ${AUTH_CHAIN_ID}`,
      `Wallet: ${normalizedAddress}`,
      `Purpose: ${purposeLabel}`,
      `Nonce: ${nonce}`,
      `Issued At: ${now.toISOString()}`,
      `Expires At: ${expiresAt.toISOString()}`,
    ].join("\n");

    await prisma.$transaction(async (db) => {
      await db.authChallenge.deleteMany({
        where: { expiresAt: { lt: now } },
      });
      await db.authChallenge.create({
        data: {
          nonce,
          address: normalizedAddress,
          purpose,
          message,
          expiresAt,
        },
      });
    });

    return { nonce, message, expiresAt };
  }

  public async verifyChallenge(
    signerAddress: string,
    purpose: AuthPurpose,
    message: string,
    signature: string,
  ) {
    const parsed = assertAuthMessageMatches({
      message,
      signerAddress,
      purpose,
      domain: AUTH_DOMAIN,
      chainId: AUTH_CHAIN_ID,
    });

    const challenge = await prisma.authChallenge.findUnique({
      where: { nonce: parsed.nonce },
    });

    const now = new Date();
    if (
      !challenge ||
      challenge.address !== parsed.wallet ||
      challenge.purpose !== purpose ||
      challenge.message !== message ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      parsed.expiresAt.getTime() !== challenge.expiresAt.getTime()
    ) {
      throw new ErrorHandler("Authentication challenge expired or already used", 401);
    }

    if (!signature || !verifySignature(message, signature, parsed.wallet)) {
      throw new ErrorHandler("Invalid wallet signature", 401);
    }

    const consumed = await prisma.authChallenge.updateMany({
      where: {
        nonce: parsed.nonce,
        address: parsed.wallet,
        purpose,
        message,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      throw new ErrorHandler("Authentication challenge expired or already used", 401);
    }
  }

  public async register(
    handle: string,
    signerAddress: string,
    smartAccountAddress: string,
    email?: string,
    authProvider?: string,
  ) {
    const normalizedSigner = signerAddress.toLowerCase();
    const normalizedSmart = smartAccountAddress.toLowerCase();

    if (normalizedSigner === normalizedSmart) {
      throw new ErrorHandler(
        "Smart account address must be different from signer address",
        400,
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { handle },
          { publicAddress: normalizedSigner },
          { smartAccountAddress: normalizedSmart },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.handle === handle)
        throw new ErrorHandler("Handle already taken", 409);
      if (existingUser.publicAddress === normalizedSigner)
        throw new ErrorHandler("This account is already registered", 409);
      if (existingUser.smartAccountAddress === normalizedSmart)
        throw new ErrorHandler("Smart account already registered", 409);
    }

    const newUser = await prisma.user.create({
      data: {
        handle,
        publicAddress: normalizedSigner,
        smartAccountAddress: normalizedSmart,
        email: email || null,
        authProvider: authProvider || null,
      },
    });

    const token = this.generateToken(newUser);

    return { user: newUser, token };
  }

  public async login(signerAddress: string) {
    const normalizedAddress = signerAddress.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { publicAddress: normalizedAddress },
    });

    if (!user) {
      throw new ErrorHandler("Account not found. Please register.", 404);
    }

    const token = this.generateToken(user);

    return { user, token };
  }

  public async logoutAll(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  public async checkHandle(handle: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });

    return !existing;
  }
}

export const authService = new AuthService();
