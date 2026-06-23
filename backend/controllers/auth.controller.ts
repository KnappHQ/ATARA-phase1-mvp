import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { verifyLoginSignature } from "../utils/signatureVerifier";

export const authController = {
  register: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const {
        handle,
        signerAddress,
        smartAccountAddress,
        email,
        authProvider,
        message,
        signature,
      } = req.body;

      if (!handle || !signerAddress || !smartAccountAddress) {
        throw new ErrorHandler(
          "Please provide handle, signerAddress, and smartAccountAddress",
          400,
        );
      }

      if (!message || !signature) {
        throw new ErrorHandler(
          "Please sign the registration message to prove wallet ownership",
          400,
        );
      }

      verifyLoginSignature(signerAddress, message, signature);

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
    const { signerAddress, message, signature } = req.body;

    if (!signerAddress || !message || !signature) {
      throw new ErrorHandler(
        "Please provide signerAddress, message, and signature",
        400,
      );
    }

    // Verify signature for security
    // This ensures only the wallet owner can log in
    verifyLoginSignature(signerAddress, message, signature);

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
