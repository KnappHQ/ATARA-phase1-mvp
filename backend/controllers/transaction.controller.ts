import { Request, Response, NextFunction } from "express";
import { transactionService } from "../services/transaction.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { TRANSACTION_CATEGORIES } from "../utils/constants";

export const transactionController = {
  resolveHandle: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { handle } = req.params;

      if (!handle) {
        throw new ErrorHandler("Handle is required", 400);
      }

      const user = await transactionService.resolveHandle(handle);

      res.status(200).json({
        success: true,
        user,
      });
    },
  ),

  syncTransaction: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const senderProfile = req.user;
      const { receiverAddress, txHash, assetSymbol, category, userNote } =
        req.body;

      if (!receiverAddress || !txHash || !assetSymbol) {
        throw new ErrorHandler("Missing required transaction data", 400);
      }

      const transaction = await transactionService.syncTransaction({
        senderProfile,
        receiverAddress,
        txHash,
        assetSymbol,
        category,
        userNote,
      });

      res.status(201).json({
        success: true,
        message: "Transaction synced successfully",
        transaction,
      });
    },
  ),

  getHistory: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;

      const history = await transactionService.getHistory(userId);
      res.status(200).json({
        success: true,
        count: history.length,
        history,
      });
    },
  ),

  getById: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await transactionService.getTransactionById(
        transactionId,
        userId,
      );

      res.status(200).json({
        success: true,
        transaction,
      });
    },
  ),

  updateTransaction: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { transactionId } = req.params;
      const { category, userNote } = req.body;

      if (!category && !userNote) {
        throw new ErrorHandler(
          "Please provide category or userNote to update",
          400,
        );
      }

      if (
        category &&
        !(TRANSACTION_CATEGORIES as readonly string[]).includes(category)
      ) {
        throw new ErrorHandler(
          `Invalid category. Must be one of: ${TRANSACTION_CATEGORIES.join(", ")}`,
          400,
        );
      }

      const userId = req.user.id;

      const transaction = await transactionService.updateTransaction(
        userId,
        transactionId,
        category,
        userNote,
      );

      res.status(200).json({
        success: true,
        message: "Transaction updated successfully",
        transaction,
      });
    },
  ),
};
