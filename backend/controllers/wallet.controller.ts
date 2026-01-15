import { Request, Response, NextFunction } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ErrorHandler } from "../utils/errorHandler";
import { walletService } from "../services/wallet.service";
import { DEFAULT_ASSET_IDS } from "../utils/constants";

export const walletController = {
  getMarketPrices: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const tokensQuery = req.query.tokens as string;
      const currency = (req.query.currency as string) || "usd";

      const tokenIds = tokensQuery
        ? tokensQuery.split(",").map((id) => id.trim())
        : DEFAULT_ASSET_IDS;

      const prices = await walletService.getTokenPrice(
        tokenIds.map((id) => id.toLowerCase()),
        currency.toLowerCase()
      );

      res.status(200).json({
        status: "success",
        data: { currency, prices, timestamp: new Date().toISOString() },
      });
    }
  ),

  getMarketOverview: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const currency = (req.query.currency as string) || "usd";

      const marketData = await walletService.getMarketOverview(currency);

      res.status(200).json({
        status: "success",
        data: marketData,
      });
    }
  ),
  
  getNews: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const news = await walletService.getCryptoNews();

      res.status(200).json({
        status: "success",
        data: news,
      });
    }
  ),
  
  getMyPortfolio: catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;

      const portfolio = await walletService.getUserPortfolio(userId);

      res.status(200).json({
        success: true,
        portfolio,
      });
    }
  ),
};
