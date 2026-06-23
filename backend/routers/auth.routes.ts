import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { authController } from "../controllers/auth.controller";

const router = Router();

const authKeyGenerator = (req: any) => {
  const signerAddress =
    typeof req.body?.signerAddress === "string"
      ? req.body.signerAddress.toLowerCase()
      : "";

  return signerAddress || ipKeyGenerator(req.ip);
};

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Too many registration attempts. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: authKeyGenerator,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post("/register", registerLimiter, authController.register);

router.post("/login", loginLimiter, authController.login);

router.get("/check-handle/:handle", authController.checkHandle);

export default router;
