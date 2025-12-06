import { Request, Response, NextFunction } from "express";
import { transactionService } from "../services/transaction.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";

export const transactionController = {
  transfer: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { receiverHandle, amount, assetSymbol, category, userNote } =
        req.body;
      const senderId = req.user.id;

      if (!receiverHandle || !amount || !assetSymbol) {
        throw new ErrorHandler(
          "Please provide receiverHandle, amount, and assetSymbol",
          400
        );
      }

      const transaction = await transactionService.transferFunds(
        senderId,
        receiverHandle,
        Number(amount),
        assetSymbol,
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

  updateTransaction: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const { category, userNote } = req.body;
      const userId = req.user.id;

      const transaction = await transactionService.updateTransaction(
        userId,
        id,
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
