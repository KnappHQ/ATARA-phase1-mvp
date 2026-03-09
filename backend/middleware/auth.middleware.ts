import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/errorHandler";
import prisma from "../config/prisma";
import { JWT_SECRET } from "../utils/constants";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authentication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new ErrorHandler("Not authorized to access this route", 401));
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        handle: true,
        email: true,
        publicAddress: true,
        smartAccountAddress: true,
      },
    });

    if (!user) {
      return next(
        new ErrorHandler(
          "The user belonging to this token no longer exists",
          401,
        ),
      );
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorHandler("Not authorized to access this route", 401));
  }
};
