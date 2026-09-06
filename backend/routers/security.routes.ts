import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authentication } from "../middleware/auth.middleware";
import { securityController } from "../controllers/security.controller";

const router = Router();
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many security attempts. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.use(authentication, securityLimiter);
router.get("/status", securityController.status);
router.post("/totp/setup", securityController.setupTotp);
router.post("/totp/enable", securityController.enableTotp);
router.post("/totp/disable", securityController.disableTotp);
router.post("/recovery-codes", securityController.recoveryCodes);
router.post("/recovery-codes/verify", securityController.verifyRecoveryCode);
router.patch("/recovery-phone", securityController.recoveryPhone);

export default router;
