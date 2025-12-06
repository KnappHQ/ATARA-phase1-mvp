import { Router } from "express";
import { transactionController } from "../controllers/transaction.controller";
import { authentication } from "../middleware/auth.middleware";

const router = Router();

router.post("/send", authentication, transactionController.transfer);

router.patch("/:id", authentication, transactionController.updateTransaction);

export default router;
