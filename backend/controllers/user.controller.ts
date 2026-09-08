import { Request, Response, NextFunction } from "express";
import { userService } from "../services/user.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import {
  normalizeDisplayName,
  normalizeEmail,
  normalizeHandle,
  normalizeProfilePicUrl,
} from "../utils/profileValidation";

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

      if (
        handle === undefined &&
        email === undefined &&
        profilePicUrl === undefined &&
        displayName === undefined
      ) {
        throw new ErrorHandler("No changes provided", 400);
      }

      // Only the fields actually supplied are validated and forwarded, so an
      // absent key never overwrites a stored value. Every supplied one is
      // normalized before it reaches the database - these values end up in
      // handle lookups, in the app's UI, and in the feedback email.
      const changes: {
        handle?: string;
        email?: string;
        profilePicUrl?: string;
        displayName?: string;
      } = {};

      if (handle !== undefined) changes.handle = normalizeHandle(handle);
      if (email !== undefined) changes.email = normalizeEmail(email);
      if (profilePicUrl !== undefined) {
        changes.profilePicUrl = normalizeProfilePicUrl(profilePicUrl);
      }
      if (displayName !== undefined) {
        changes.displayName = normalizeDisplayName(displayName);
      }

      const updatedUser = await userService.updateProfile(userId, changes);

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: updatedUser,
      });
    },
  ),

  deleteAccount: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      if (req.body?.confirmation !== "DELETE") {
        throw new ErrorHandler(
          "Account deletion confirmation is required",
          400,
        );
      }

      await userService.deleteAccount(req.user.id);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
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
          address: user.smartAccountAddress,
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
