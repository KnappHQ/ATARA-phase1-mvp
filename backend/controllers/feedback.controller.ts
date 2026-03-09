import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { feedbackService } from "../services/feedback.service";

export const feedbackController = {
  submit: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { message } = req.body;

      if (!message || !message.trim()) {
        throw new ErrorHandler("Feedback message is required", 400);
      }

      if (message.trim().length > 500) {
        throw new ErrorHandler("Feedback must be 500 characters or fewer", 400);
      }

      const feedback = await feedbackService.submit({
        userId: req.user?.id,
        handle: req.user?.handle,
        message: message.trim(),
      });

      res.status(201).json({
        success: true,
        message: "Feedback submitted successfully",
        feedbackId: feedback.id,
      });
    },
  ),
};
