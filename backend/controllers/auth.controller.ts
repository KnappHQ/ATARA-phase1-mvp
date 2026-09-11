import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { assertSmartAccountOwnedBySigner } from "../services/smartAccountOwnership.service";
import { normalizeHandle } from "../utils/profileValidation";

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

      const allowedAuthProviders = [
        "passkey",
        "external_wallet",
        "google",
        "apple",
      ];
      if (
        authProvider !== undefined &&
        !allowedAuthProviders.includes(authProvider)
      ) {
        throw new ErrorHandler("Unsupported authentication provider", 400);
      }

      await authService.verifyChallenge(
        signerAddress,
        "register",
        message,
        signature,
      );
      await assertSmartAccountOwnedBySigner(signerAddress, smartAccountAddress);

      // Same definition of a valid handle as `PATCH /user/me`, so registration
      // and profile update cannot drift apart.
      const normalizedHandle = normalizeHandle(handle);

      const { user, token } = await authService.register(
        normalizedHandle,
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

      // Handles are stored canonically lowercase, so availability must be
      // checked in that form - otherwise "Alice" reports free while "alice"
      // exists, and registration then fails with a 409.
      const available = await authService.checkHandle(
        handle.trim().toLowerCase(),
      );

      res.status(200).json({
        success: true,
        available,
      });
    },
  ),
};
