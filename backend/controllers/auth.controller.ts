import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";

export const authController = {
  register: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { handle, password } = req.body;

      if (!handle || !password) {
        throw new ErrorHandler("Please provide handle and password", 400);
      }

      const { user, token } = await authService.register(handle, password);

      const { passwordHash, ...safeUser } = user;

      res.status(201).json({
        success: true,
        message: "User created successfully",
        token,
        user: safeUser,
      });
    }
  ),
  login: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { handle, password } = req.body;

    if (!handle || !password) {
      throw new ErrorHandler("Please provide handle and password", 400);
    }

    const { user, token } = await authService.login(handle, password);

    const { passwordHash, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
    });
  }),
};
