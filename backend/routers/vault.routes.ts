import { Router } from "express";
import { authentication } from "../middleware/auth.middleware";
import { vaultController } from "../controllers/vault.controller";

const router = Router();
router.use(authentication);
router.get("/", vaultController.list);
router.get("/:vaultAddress", vaultController.snapshot);

export default router;
