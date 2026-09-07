import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

const challengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many authentication attempts. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

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
  message: "Too many login attempts. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const handleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many handle checks. Please try again later.",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.post("/challenge", challengeLimiter, authController.challenge);
router.post("/register", registerLimiter, authController.register);
router.post("/login", loginLimiter, authController.login);
router.post("/logout-all", authentication, authController.logoutAll);
router.get("/check-handle/:handle", handleLimiter, authController.checkHandle);

export default router;
