import { Request, Response, NextFunction } from "express";
import { transactionService } from "../services/transaction.service";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { TxStatus } from "../generated/prisma";
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
      const {
        receiverAddress,
        txHash,
        amount,
        rawAmountWei,
        assetSymbol,
        category,
        userNote,
      } = req.body;

      if (
        !receiverAddress ||
        !txHash ||
        !amount ||
        !rawAmountWei ||
        !assetSymbol
      ) {
        throw new ErrorHandler("Missing required transaction data", 400);
      }

      const transaction = await transactionService.syncTransaction({
        senderProfile,
        receiverAddress,
        txHash,
        amount,
        rawAmountWei,
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
      const { category, userNote, status } = req.body;

      if (!category && !userNote && !status) {
        throw new ErrorHandler(
          "Please provide category, userNote, or status to update",
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

      if (status && !["PENDING", "COMPLETED", "FAILED"].includes(status)) {
        throw new ErrorHandler("Invalid status value", 400);
      }

      const userId = req.user.id;

      const transaction = await transactionService.updateTransaction(
        userId,
        transactionId,
        status as TxStatus,
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
