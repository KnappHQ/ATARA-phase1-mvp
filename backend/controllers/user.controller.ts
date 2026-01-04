import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";

export const userController = {
  getMe: catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;

    const user = await userService.getProfile(userId);

    res.status(200).json({
      success: true,
      user,
    });
  }),

  updateProfile: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { handle, email, profilePicUrl, displayName } = req.body;

      if (!handle && !email && !profilePicUrl && !displayName) {
        throw new ErrorHandler("No changes provided", 400);
      }

      const updatedUser = await userService.updateProfile(userId, {
        handle,
        email,
        profilePicUrl,
        displayName,
      });

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    }
  ),
  checkHandleAvailability: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { handle } = req.query;

      if (!handle || typeof handle !== "string") {
        throw new ErrorHandler("Handle is required", 400);
      }
      const isAvailable = await userService.checkHandleAvailability(
        handle.toLowerCase()
      );

      res.status(200).json({
        success: true,
        available: isAvailable,
      });
    }
  ),
};
