import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { safetyController } from "../controllers/safety.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

// Reports reach a person's inbox: a flood of them is its own kind of abuse.
const reportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.get("/blocks", authentication, safetyController.listBlocks);
router.post("/blocks", authentication, safetyController.block);
router.delete("/blocks/:handle", authentication, safetyController.unblock);
router.post("/reports", authentication, reportLimiter, safetyController.report);

// ATARA's team only: guarded by the x-admin-token header, not by a user session.
router.get("/admin/reports", safetyController.adminListReports);
router.patch("/admin/reports/:id", safetyController.adminSetStatus);

export default router;
