import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { vaultService } from "../services/vault.service";
import { ErrorHandler } from "../utils/errorHandler";

const requireSmartAccount = (req: Request) => {
  if (!req.user?.smartAccountAddress) {
    throw new ErrorHandler("Your smart account is not ready yet", 409);
  }
  return req.user.smartAccountAddress as string;
};

export const vaultController = {
  list: catchAsync(async (req: Request, res: Response) => {
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);
    const result = await vaultService.getVaults(requireSmartAccount(req), offset, limit);
    res.status(200).json({ success: true, ...result });
  }),

  snapshot: catchAsync(async (req: Request, res: Response) => {
    const snapshot = await vaultService.getSnapshot(
      req.params.vaultAddress,
      requireSmartAccount(req),
    );
    res.status(200).json({ success: true, snapshot });
  }),
};
