import { Request, Response, NextFunction } from "express";
import { transactionService } from "../services/transaction.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";

export const transactionController = {
  transfer: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { receiver, amount, asset, category, userNote } = req.body;
      const senderId = req.user.id;

      if (!receiver || !amount || !asset) {
        throw new ErrorHandler(
          "Please provide receiver, amount, and asset",
          400
        );
      }

      const transaction = await transactionService.transferFunds(
        senderId,
        receiver,
        Number(amount),
        asset,
        category,
        userNote
      );

      res.status(200).json({
        success: true,
        message: "Transfer successful",
        transaction,
      });
    }
  ),

  getHistory: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;

      const transactions = await transactionService.getTransactionsByUser(
        userId
      );

      res.status(200).json({
        success: true,
        count: transactions.length,
        transactions,
      });
    }
  ),

  getById: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { transactionId } = req.params;
      const userId = req.user.id;

      const transaction = await transactionService.getTransactionById(
        transactionId,
        userId
      );

      res.status(200).json({
        success: true,
        transaction,
      });
    }
  ),

  updateTransaction: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { transactionId } = req.params;
      const { category, userNote } = req.body;

      if (!category && !userNote) {
        throw new ErrorHandler(
          "Please provide category or userNote to update",
          400
        );
      }
      const userId = req.user.id;

      const transaction = await transactionService.updateTransaction(
        userId,
        transactionId,
        category,
        userNote
      );

      res.status(200).json({
        success: true,
        message: "Transaction updated successfully",
        transaction,
      });
    }
  ),
};
