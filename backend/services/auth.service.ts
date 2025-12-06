import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { JWT_EXPIRES_IN, JWT_SECRET, SALT_ROUNDS } from "../utils/constants";

class AuthService {
  public async register(handle: string, password: string) {
    const existingUser = await prisma.user.findFirst({
      where: {
        handle,
      },
    });

    if (existingUser) {
      throw new ErrorHandler("Handle already taken", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          handle,
          passwordHash,
          wallets: {
            create: [
              { assetSymbol: "BTC", balance: 10000.0 },
              { assetSymbol: "ETH", balance: 10000.0 },
              { assetSymbol: "SOL", balance: 10000.0 },
            ],
          },
        },
        include: {
          wallets: true,
        },
      });

      return user;
    });

    const token = jwt.sign(
      { id: newUser.id, handle: newUser.handle },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      }
    );

    return { user: newUser, token };
  }

  public async login(handle: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { handle },
    });

    if (!user) {
      throw new ErrorHandler("Invalid handle or password", 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      throw new ErrorHandler("Invalid handle or password", 401);
    }

    const token = jwt.sign({ id: user.id, handle: user.handle }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { user, token };
  }
}

export const authService = new AuthService();
