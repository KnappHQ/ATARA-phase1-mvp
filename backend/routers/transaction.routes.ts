import { Router } from "express";
import { transactionController } from "../controllers/transaction.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.get(
  "/resolve/:handle",
  authentication,
  transactionController.resolveHandle
);
router.post("/sync", authentication, transactionController.syncTransaction);
router.get("/history", authentication, transactionController.getHistory);
router.get("/:transactionId", authentication, transactionController.getById);
router.patch(
  "/:transactionId",
  authentication,
  transactionController.updateTransaction
);

export default router;
