import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { ErrorHandler } from "../utils/errorHandler";
import { JWT_EXPIRES_IN, JWT_SECRET, SALT_ROUNDS } from "../utils/constants";

class AuthService {
  public async register(
    handle: string,
    password: string,
    publicAddress: string
  ) {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ handle }, { publicAddress }],
      },
    });

    if (existingUser) {
      if (existingUser.handle === handle)
        throw new ErrorHandler("Handle already taken", 409);
      if (existingUser.publicAddress === publicAddress)
        throw new ErrorHandler("Wallet address already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.user.create({
      data: {
        handle,
        passwordHash,
        publicAddress,
      },
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
