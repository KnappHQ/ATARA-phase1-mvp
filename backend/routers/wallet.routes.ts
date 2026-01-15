import { Router } from "express";
import { walletController } from "../controllers/wallet.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.get("/prices", walletController.getMarketPrices);

router.get("/portfolio", authentication, walletController.getMyPortfolio);

router.get("/market-overview", walletController.getMarketOverview);

router.get("/news", walletController.getNews);

export default router;
