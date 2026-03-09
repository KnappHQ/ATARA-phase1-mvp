import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";

export const authController = {
  register: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const {
        handle,
        signerAddress,
        smartAccountAddress,
        email,
        authProvider,
      } = req.body;

      if (!handle || !signerAddress) {
        throw new ErrorHandler("Please provide handle and signerAddress", 400);
      }

      if (handle.length < 3 || handle.length > 20) {
        throw new ErrorHandler(
          "Handle must be between 3 and 20 characters",
          400,
        );
      }

      if (!/^[a-z0-9_]+$/.test(handle)) {
        throw new ErrorHandler(
          "Handle can only contain lowercase letters, numbers, and underscores",
          400,
        );
      }

      const { user, token } = await authService.register(
        handle,
        signerAddress,
        smartAccountAddress,
        email,
        authProvider,
      );

      res.status(201).json({
        success: true,
        message: "User created successfully",
        token,
        user,
      });
    },
  ),

  login: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { signerAddress } = req.body;

    if (!signerAddress) {
      throw new ErrorHandler("Please provide signerAddress", 400);
    }

    const { user, token } = await authService.login(signerAddress);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  }),

  checkHandle: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { handle } = req.params;

      if (!handle || handle.length < 3) {
        throw new ErrorHandler("Handle must be at least 3 characters", 400);
      }

      const available = await authService.checkHandle(handle);

      res.status(200).json({
        success: true,
        available,
      });
    },
  ),
};
