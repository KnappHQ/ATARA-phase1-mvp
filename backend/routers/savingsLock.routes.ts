import { Router } from "express";
import { authentication } from "../middleware/auth.middleware";
import { savingsLockController } from "../controllers/savingsLock.controller";

const router = Router();
router.use(authentication);
router.get("/", savingsLockController.list);
router.get("/:lockAddress", savingsLockController.snapshot);

export default router;
