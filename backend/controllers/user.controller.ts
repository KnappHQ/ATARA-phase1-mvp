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
    },
  ),

  search: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(200).json({ success: true, users: [] });
      }

      const users = await userService.searchUsers(q);

      res.status(200).json({
        success: true,
        users,
      });
    },
  ),

  getQuickContacts: catchAsync(async (req: Request, res: Response) => {
    const contacts = await userService.getRecentContacts(req.user.id);

    res.status(200).json({
      success: true,
      contacts,
    });
  }),

  getUserByHandle: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { handle } = req.params;
      const { includeAddress } = req.query;

      if (!handle) {
        throw new ErrorHandler("Handle is required", 400);
      }

      const user = await userService.getUserByHandle(handle.toLowerCase());

      if (includeAddress === "true") {
        res.status(200).json({
          success: true,
          address: user.smartAccountAddress || user.publicAddress,
          user,
        });
      } else {
        res.status(200).json({
          success: true,
          user,
        });
      }
    },
  ),
};
