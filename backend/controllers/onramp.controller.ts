import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { createMoonPaySession } from "../services/onramp.service";

export const onrampController = {
  createSession: catchAsync(async (req: Request, res: Response) => {
    const walletAddress = req.user?.smartAccountAddress;
    if (!walletAddress) {
      throw new ErrorHandler(
        "Your smart account is not ready yet. Finish wallet setup first.",
        409,
      );
    }

    const baseCurrencyAmount = req.body?.baseCurrencyAmount;
    const session = createMoonPaySession({
      walletAddress,
      userId: req.user.id,
      email: req.user.email,
      baseCurrencyAmount,
    });

    res.status(200).json({ success: true, session });
  }),
};
