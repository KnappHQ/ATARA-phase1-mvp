import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { assertSmartAccountOwnedBySigner } from "../services/smartAccountOwnership.service";

export const authController = {
  challenge: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { signerAddress, purpose } = req.body;

      if (!signerAddress || (purpose !== "login" && purpose !== "register")) {
        throw new ErrorHandler(
          "Please provide signerAddress and purpose (login or register)",
          400,
        );
      }

      const challenge = await authService.createChallenge(signerAddress, purpose);
      res.status(201).json({ success: true, ...challenge });
    },
  ),

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
          "Please sign the registration challenge to prove wallet ownership",
          400,
        );
      }

      await authService.verifyChallenge(
        signerAddress,
        "register",
        message,
        signature,
      );
      await assertSmartAccountOwnedBySigner(signerAddress, smartAccountAddress);

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

    await authService.verifyChallenge(
      signerAddress,
      "login",
      message,
      signature,
    );

    const { user, token } = await authService.login(signerAddress);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  }),

  logoutAll: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      await authService.logoutAll(req.user.id);
      res.status(200).json({ success: true, message: "All sessions revoked" });
    },
  ),

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
