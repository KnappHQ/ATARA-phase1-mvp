import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../utils/constants";

class AuthService {
  private generateToken(user: {
    id: string;
    handle: string;
    publicAddress: string;
    smartAccountAddress?: string | null;
  }) {
    return jwt.sign(
      {
        id: user.id,
        handle: user.handle,
        address: user.smartAccountAddress,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );
  }

  public async register(
    handle: string,
    signerAddress: string,
    smartAccountAddress?: string,
    email?: string,
    authProvider?: string,
  ) {
    const normalizedSigner = signerAddress.toLowerCase();
    const normalizedSmart = smartAccountAddress?.toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { handle },
          { publicAddress: normalizedSigner },
          ...(normalizedSmart
            ? [{ smartAccountAddress: normalizedSmart }]
            : []),
        ],
      },
    });

    if (existingUser) {
      if (existingUser.handle === handle)
        throw new ErrorHandler("Handle already taken", 409);
      if (existingUser.publicAddress === normalizedSigner)
        throw new ErrorHandler("This account is already registered", 409);
      if (
        normalizedSmart &&
        existingUser.smartAccountAddress === normalizedSmart
      )
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

  public async checkHandle(handle: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });

    return !existing;
  }
}

export const authService = new AuthService();
