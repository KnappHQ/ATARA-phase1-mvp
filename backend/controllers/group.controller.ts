import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { groupService } from "../services/group.service";

export const groupController = {
  createGroup: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { name, description, memberHandles } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        throw new ErrorHandler("Group name is required", 400);
      }

      if (name.trim().length > 60) {
        throw new ErrorHandler("Group name must not exceed 60 characters", 400);
      }

      if (memberHandles !== undefined && !Array.isArray(memberHandles)) {
        throw new ErrorHandler(
          "memberHandles must be an array of handles",
          400,
        );
      }

      const group = await groupService.createGroup(
        userId,
        name.trim(),
        description?.trim(),
        memberHandles,
      );

      res.status(201).json({
        success: true,
        message: "Group created successfully",
        group,
      });
    },
  ),

  getMyGroups: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;

      const groups = await groupService.getMyGroups(userId);

      res.status(200).json({
        success: true,
        groups,
      });
    },
  ),

  getGroupDetails: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;

      const group = await groupService.getGroupDetails(groupId, userId);

      res.status(200).json({
        success: true,
        group,
      });
    },
  ),

  updateGroup: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;
      const { name, description } = req.body;

      if (
        name !== undefined &&
        (typeof name !== "string" || name.trim().length === 0)
      ) {
        throw new ErrorHandler("Group name cannot be empty", 400);
      }

      if (name && name.trim().length > 60) {
        throw new ErrorHandler("Group name must not exceed 60 characters", 400);
      }

      const updated = await groupService.updateGroup(groupId, userId, {
        name: name?.trim(),
        description: description?.trim(),
      });

      res.status(200).json({
        success: true,
        message: "Group updated successfully",
        group: updated,
      });
    },
  ),

  deleteGroup: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;

      await groupService.deleteGroup(groupId, userId);

      res.status(200).json({
        success: true,
        message: "Group deleted successfully",
      });
    },
  ),

  addMembers: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;
      const { handles } = req.body;

      if (!handles || !Array.isArray(handles) || handles.length === 0) {
        throw new ErrorHandler("handles must be a non-empty array", 400);
      }

      const added = await groupService.addMembers(groupId, userId, handles);

      res.status(200).json({
        success: true,
        message: `${added.length} member(s) added successfully`,
        added,
      });
    },
  ),

  removeMember: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId, memberId } = req.params;

      await groupService.removeMember(groupId, userId, memberId);

      res.status(200).json({
        success: true,
        message: "Member removed successfully",
      });
    },
  ),

  addExpense: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;
      const { description, amount, splitWithUserIds } = req.body;

      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length === 0
      ) {
        throw new ErrorHandler("Expense description is required", 400);
      }

      if (
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new ErrorHandler("A valid positive amount is required", 400);
      }

      if (splitWithUserIds !== undefined && !Array.isArray(splitWithUserIds)) {
        throw new ErrorHandler(
          "splitWithUserIds must be an array of user IDs",
          400,
        );
      }

      const expense = await groupService.addExpense(
        groupId,
        userId,
        description.trim(),
        Number(amount),
        splitWithUserIds,
      );

      res.status(201).json({
        success: true,
        message: "Expense added and split equally",
        expense,
      });
    },
  ),

  getExpenses: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId } = req.params;

      const expenses = await groupService.getExpenses(groupId, userId);

      res.status(200).json({
        success: true,
        expenses,
      });
    },
  ),

  deleteExpense: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { expenseId } = req.params;

      await groupService.deleteExpense(expenseId, userId);

      res.status(200).json({
        success: true,
        message: "Expense deleted successfully",
      });
    },
  ),

  settleMyShare: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { expenseId } = req.params;
      const { txHash, assetSymbol, amount, rawAmountWei, tokenPriceUsd } =
        req.body;

      if (!txHash || typeof txHash !== "string") {
        throw new ErrorHandler("txHash is required", 400);
      }
      if (!assetSymbol || typeof assetSymbol !== "string") {
        throw new ErrorHandler(
          "assetSymbol is required (e.g. ETH, USDC, USDT)",
          400,
        );
      }
      if (
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new ErrorHandler("A valid positive amount is required", 400);
      }
      if (!rawAmountWei || typeof rawAmountWei !== "string") {
        throw new ErrorHandler("rawAmountWei is required", 400);
      }
      if (
        tokenPriceUsd === undefined ||
        isNaN(Number(tokenPriceUsd)) ||
        Number(tokenPriceUsd) <= 0
      ) {
        throw new ErrorHandler(
          "A valid positive tokenPriceUsd is required",
          400,
        );
      }

      const split = await groupService.settleMyShare(
        expenseId,
        userId,
        txHash,
        assetSymbol.toUpperCase(),
        Number(amount),
        rawAmountWei,
        Number(tokenPriceUsd),
      );

      res.status(200).json({
        success: true,
        message: "Your share has been marked as settled",
        split,
      });
    },
  ),

  getSettleAllAmount: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId, memberId } = req.params;

      const totalUsd = await groupService.getSettleAllAmount(
        groupId,
        userId,
        memberId,
      );

      res.status(200).json({
        success: true,
        totalUsd,
      });
    },
  ),

  settleAllWithMember: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId, memberId } = req.params;
      const { txHash, assetSymbol, amount, rawAmountWei, tokenPriceUsd } =
        req.body;

      if (!txHash || typeof txHash !== "string") {
        throw new ErrorHandler("txHash is required", 400);
      }
      if (!assetSymbol || typeof assetSymbol !== "string") {
        throw new ErrorHandler(
          "assetSymbol is required (e.g. ETH, USDC, USDT)",
          400,
        );
      }
      if (
        amount === undefined ||
        isNaN(Number(amount)) ||
        Number(amount) <= 0
      ) {
        throw new ErrorHandler("A valid positive amount is required", 400);
      }
      if (!rawAmountWei || typeof rawAmountWei !== "string") {
        throw new ErrorHandler("rawAmountWei is required", 400);
      }
      if (
        tokenPriceUsd === undefined ||
        isNaN(Number(tokenPriceUsd)) ||
        Number(tokenPriceUsd) <= 0
      ) {
        throw new ErrorHandler(
          "A valid positive tokenPriceUsd is required",
          400,
        );
      }

      await groupService.settleAllWithMember(
        groupId,
        userId,
        memberId,
        txHash,
        assetSymbol.toUpperCase(),
        Number(amount),
        rawAmountWei,
        Number(tokenPriceUsd),
      );

      res.status(200).json({
        success: true,
        message: "All balances settled with this member",
      });
    },
  ),

  markAsSettledManually: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId, memberId } = req.params;

      await groupService.markAsSettledManually(groupId, userId, memberId);

      res.status(200).json({
        success: true,
        message: "Balance marked as settled manually",
      });
    },
  ),

  settleByInternalTx: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { groupId, memberId } = req.params;
      const { transactionId } = req.body;

      if (!transactionId || typeof transactionId !== "string") {
        throw new ErrorHandler("transactionId is required", 400);
      }

      await groupService.settleAllWithMemberByInternalTx(
        groupId,
        userId,
        memberId,
        transactionId,
      );

      res.status(200).json({
        success: true,
        message: "All balances settled with this member",
      });
    },
  ),
};
