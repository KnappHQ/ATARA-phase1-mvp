import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { providerService } from "../services/provider.service";
import { swapService } from "../services/swap.service";
import { ErrorHandler } from "../utils/errorHandler";

export const transactionController = {
  /**
   * POST /api/transaction/simulate
   * Body: { from, to, amount }
   */
  simulateSend: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { from, to, amount } = req.body;

      if (!from || !to || !amount) {
        return next(
          new ErrorHandler("Missing required fields: from, to, amount", 400)
        );
      }

      const simulationResult = await providerService.simulateTransaction(
        from,
        to,
        amount
      );

      res.status(200).json({
        status: "success",
        data: simulationResult,
      });
    }
  ),

  /**
   * GET /api/transaction/swap-quote
   * Query: ?sellToken=ETH&buyToken=DAI&sellAmount=100000...
   */
  getSwapQuote: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { sellToken, buyToken, sellAmount, taker } = req.query;

      if (!sellToken || !buyToken || !sellAmount || !taker) {
        return next(
          new ErrorHandler(
            "Missing params: sellToken, buyToken, sellAmount, taker",
            400
          )
        );
      }

      const quote = await swapService.getQuote(
        sellToken as string,
        buyToken as string,
        sellAmount as string,
        taker as string
      );

      res.status(200).json({
        status: "success",
        data: quote,
      });
    }
  ),
};
