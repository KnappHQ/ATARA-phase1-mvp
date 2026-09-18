import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { savingsLockService } from "../services/savingsLock.service";
import { ErrorHandler } from "../utils/errorHandler";

const requireSmartAccount = (req: Request) => {
  if (!req.user?.smartAccountAddress) {
    throw new ErrorHandler("Your smart account is not ready yet", 409);
  }
  return req.user.smartAccountAddress as string;
};

export const savingsLockController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);
    const result = await savingsLockService.getLocks(requireSmartAccount(req), offset, limit);
    res.status(200).json({ success: true, ...result });
  }),

  snapshot: catchAsync(async (req: Request, res: Response) => {
    const snapshot = await savingsLockService.getSnapshot(
      req.params.lockAddress,
      requireSmartAccount(req),
    );
    res.status(200).json({ success: true, snapshot });
  }),
};
