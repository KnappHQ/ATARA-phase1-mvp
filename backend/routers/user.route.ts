import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { userController } from "../controllers/user.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

// The global limiter allows 100 requests per 15 minutes, which is generous
// enough to enumerate the directory a handful of accounts at a time. Search is
// the one read worth limiting on its own, as paymentRequest.routes.ts does.
const searchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/me", authentication, userController.getMe);

router.patch("/me", authentication, userController.updateProfile);

router.delete("/me", authentication, userController.deleteAccount);

router.get("/search", authentication, searchLimiter, userController.search);

router.get("/quick-contacts", authentication, userController.getQuickContacts);

router.get("/handle/:handle", authentication, userController.getUserByHandle);

export default router;
