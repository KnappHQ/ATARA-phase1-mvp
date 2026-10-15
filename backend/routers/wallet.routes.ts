import { Router } from "express";
import { walletController } from "../controllers/wallet.controller";
import { authentication } from "../middleware/auth.middleware";
import { onrampController } from "../controllers/onramp.controller";

const router = Router();

router.get("/portfolio", authentication, walletController.getMyPortfolio);
router.post("/onramp-session", authentication, onrampController.createSession);
router.get("/onramp-ip-check", authentication, onrampController.ipCheck);

export default router;
