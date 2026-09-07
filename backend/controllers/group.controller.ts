import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { groupService } from "../services/group.service";

export const groupController = {
  decideSplit: catchAsync(async (req, res) => {
    const split = await groupService.decideSplit(req.params.expenseId, req.user.id, req.body.decision);
    res.json({ success: true, split });
  }),
  createSettlementIntent: catchAsync(async (req, res) => {
    const intent = await groupService.createSettlementIntent(req.params.groupId, req.user.id, req.params.memberId);
    res.status(201).json({ success: true, intent });
  }),
  contactBalances: catchAsync(async (req, res) => {
    const balances = await groupService.contactBalances(req.user.id, req.params.address);
    res.json({ success: true, balances });
  }),
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
      const { description, amount, splitWithUserIds, customSplits, clientRequestId } = req.body;

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
        amount,
        splitWithUserIds, customSplits, clientRequestId,
      );

      res.status(201).json({
        success: true,
        message: "Expense proposed; each participant must accept their share",
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
        transactionId, req.body.intentId,
      );

      res.status(200).json({
        success: true,
        message: "All balances settled with this member",
      });
    },
  ),
};
